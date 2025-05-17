from dotenv import load_dotenv
import os
import paho.mqtt.client as mqtt
import ssl
import logging
import random
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import time
import signal
import sys

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# EMQX Serverless settings
BROKER = os.getenv("EMQX_BROKER")
PORT = int(os.getenv("EMQX_PORT", "8883"))
COMMAND_TOPIC = os.getenv("EMQX_COMMAND_TOPIC", "esp32/command")
SUBSCRIBE_TOPICS = [
    "server/diagnostics/esp32",
    "server/request/mobile",
    "server/test"
]
PUBLISH_TOPICS = [
    "esp32/data",
    "esp32/alter/state",
    "esp32/alter/mode",
    "esp32/alter/gps"
]
USERNAME = os.getenv("EMQX_USERNAME")
PASSWORD = os.getenv("EMQX_PASSWORD")
CLIENT_ID = f"python-mqtt-server-{random.randint(0, 1000)}"
CA_CERT = os.path.join(os.path.dirname(__file__), os.getenv("EMQX_CA_CERT", "emqxsl-ca.crt"))
FIRST_RECONNECT_DELAY = 1
RECONNECT_RATE = 2
MAX_RECONNECT_COUNT = 12
MAX_RECONNECT_DELAY = 60

# Global flag for clean shutdown (TLDR: FLAG for SHUTDOWN)
intentional_disconnect = False

# Validate environment variables
if not all([BROKER, USERNAME, PASSWORD]):
    logger.error("Missing required environment variables (EMQX_BROKER, EMQX_USERNAME, EMQX_PASSWORD)")
    sys.exit(1)




# -/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-



# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT Broker!")
        for topic in SUBSCRIBE_TOPICS:
            client.subscribe(topic, qos=1)
            logger.info(f"Subscribed to {topic}")
    else:
        logger.error(f"Connection failed with code {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
        # Save and log to "signals.log"
        logger.info(f"Received: {payload} on topic {msg.topic}")
        with open("signals.log", "a") as f:
            f.write(f"{msg.topic}: {payload}\n")
        
        # Parse payload
        data = json.loads(payload)
        client_id = data.get("client_id", "unknown")
        
        # Handle different topics
        # STILL BUILFING, NOT FINAL
        if msg.topic == "server/diagnostics/esp32":
            gps_data = data.get("gps", {})
            if gps_data:
                logger.info(f"Processing GPS data from {client_id}: {gps_data}")
                # CURRENTLY BUILDING LOGIC
                # Publish GPS data to esp32/data
                publish_data(client, {"gps": gps_data, "client_id": client_id})
                # Publish state update to esp32/alter/state
                publish_state(client, {"state": "updated", "client_id": client_id})
        
        elif msg.topic == "server/request/mobile":
            state = data.get("state", "unknown").lower()
            logger.info(f"Mobile state request from {client_id}: {state}")
            if state == "unlock":
                # Publish alert to esp32/alter/state
                publish_state(client, {"state": "unlock", "client_id": client_id})
            elif state == "lock":
                # Publish alert to esp32/alter/state
                publish_state(client, {"state": "lock", "client_id": client_id})
            else:
                # Handles all other cases, error catching
                logger.warning(f"Invalid state request from {client_id}: {state}")
        
        elif msg.topic == "server/test":
            value = data.get("value", 0)
            command = "ON" if value > 50 else "OFF"
            result = client.publish(COMMAND_TOPIC, command, qos=1)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Published command: {command} to {COMMAND_TOPIC}")
            else:
                logger.error(f"Failed to publish command to {COMMAND_TOPIC}")
        
    except Exception as e:
        logger.error(f"Error processing message on {msg.topic}: {e}")

def on_connect_fail(client, userdata):
    logger.error("Connection to MQTT broker failed")

def on_disconnect(client, userdata, rc):
    global intentional_disconnect
    if intentional_disconnect:
        logger.info("Intentional disconnection, no reconnection attempted")
        return
    logger.info(f"Unexpected disconnection with result code: {rc}")
    reconnect(client)


# -/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-


# Separate publish functions for each topic
# For Sanity Testing("publish_data")
def publish_data(client, message):
    topic = "esp32/data"
    msg = json.dumps(message) if isinstance(message, dict) else str(message)
    result = client.publish(topic, msg, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        logger.info(f"Sent `{msg}` to topic {topic}")
    else:
        logger.error(f"Failed to send message to topic {topic}")

def publish_state(client, message):
    topic = "esp32/alter/state"
    msg = json.dumps(message) if isinstance(message, dict) else str(message)
    result = client.publish(topic, msg, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        logger.info(f"Sent `{msg}` to topic {topic}")
    else:
        logger.error(f"Failed to send message to topic {topic}")

def publish_mode(client, message):
    topic = "esp32/alter/mode"
    msg = json.dumps(message) if isinstance(message, dict) else str(message)
    result = client.publish(topic, msg, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        logger.info(f"Sent `{msg}` to topic {topic}")
    else:
        logger.error(f"Failed to send message to topic {topic}")

def publish_gps(client, message):
    topic = "esp32/alter/gps"
    msg = json.dumps(message) if isinstance(message, dict) else str(message)
    result = client.publish(topic, msg, qos=1)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        logger.info(f"Sent `{msg}` to topic {topic}")
    else:
        logger.error(f"Failed to send message to topic {topic}")


# -/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-


# Reconnection logic
def reconnect(client):
    global intentional_disconnect
    reconnect_count, reconnect_delay = 0, FIRST_RECONNECT_DELAY
    while reconnect_count < MAX_RECONNECT_COUNT and not intentional_disconnect:
        logger.info(f"Reconnecting in {reconnect_delay} seconds...")
        time.sleep(reconnect_delay)
        try:
            client.reconnect()
            logger.info("Reconnected successfully!")
            return
        except Exception as err:
            logger.error(f"Reconnect failed: {err}")
        reconnect_delay *= RECONNECT_RATE
        reconnect_delay = min(reconnect_delay, MAX_RECONNECT_DELAY)
        reconnect_count += 1
    if not intentional_disconnect:
        logger.error(f"Reconnect failed after {reconnect_count} attempts. Exiting...")
        sys.exit(1)

# HTTP Server for Render Health Checks
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Server is running")

def run_http_server():
    server_address = ("0.0.0.0", int(os.getenv("PORT", 8080)))
    httpd = HTTPServer(server_address, HealthCheckHandler)
    logger.info(f"Starting HTTP server on port {os.getenv('PORT', 8080)}...")
    httpd.serve_forever()


# -/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-


# Set up MQTT client
try:
    client = mqtt.Client(client_id=CLIENT_ID, protocol=mqtt.MQTTv311)
    client.username_pw_set(USERNAME, PASSWORD)
    if not os.path.exists(CA_CERT):
        logger.error(f"CA certificate file not found: {CA_CERT}")
        sys.exit(1)
    client.tls_set(
        ca_certs=CA_CERT,
        cert_reqs=ssl.CERT_REQUIRED,
        tls_version=ssl.PROTOCOL_TLSv1_2
    )
    client.tls_insecure_set(False)
    client.on_connect = on_connect
    client.on_connect_fail = on_connect_fail
    client.on_message = on_message
    client.on_disconnect = on_disconnect
except Exception as e:
    logger.error(f"Failed to initialize MQTT client: {e}")
    sys.exit(1)

# Connect to broker
try:
    logger.info(f"Connecting to {BROKER}:{PORT}")
    client.connect(str(BROKER), PORT, keepalive=60)
except Exception as e:
    logger.error(f"Connection failed: {e}")
    sys.exit(1)


# -/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-/-


# Signal handler for clean shutdown
def signal_handler(sig, frame):
    global intentional_disconnect
    logger.info("Signal received, shutting down")
    intentional_disconnect = True
    client.disconnect()
    client.loop_stop()
    logger.info("MQTT client stopped")
    sys.exit(0)

# Main function
def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    try:
        client.loop_start()
        run_http_server()
    except Exception as e:
        logger.error(f"Error in server: {e}")
        global intentional_disconnect
        intentional_disconnect = True
        client.disconnect()
        client.loop_stop()
        sys.exit(1)

if __name__ == "__main__":
    main()