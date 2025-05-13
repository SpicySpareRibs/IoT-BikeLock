from dotenv import load_dotenv
import os
import paho.mqtt.client as mqtt
import ssl
import logging
import random
import time
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# EMQX Serverless settings
BROKER = os.getenv("EMQX_BROKER", "SECRET_ADD")
PORT = int(os.getenv("EMQX_PORT", "8883"))
DATA_TOPIC = os.getenv("EMQX_DATA_TOPIC", "esp32/data")
COMMAND_TOPIC = os.getenv("EMQX_COMMAND_TOPIC", "esp32/command")
USERNAME = os.getenv("EMQX_USERNAME", "SECRETUSER")
PASSWORD = os.getenv("EMQX_PASSWORD", "SECRETPASS")
CLIENT_ID = f"python-mqtt-server-{random.randint(0, 1000)}"
CA_CERT = os.getenv("EMQX_CA_CERT", "emqxsl-ca.crt")
FIRST_RECONNECT_DELAY = 1
RECONNECT_RATE = 2
MAX_RECONNECT_COUNT = 12
MAX_RECONNECT_DELAY = 60

# Flag to track intentional disconnection
intentional_disconnect = False

# Callback when the client connects to the broker
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT Broker!")
        client.subscribe(DATA_TOPIC, qos=1)
        logger.info(f"Subscribed to {DATA_TOPIC}")
    else:
        logger.error(f"Connection failed with code {rc}")

# Callback when a message is received
def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
        logger.info(f"Received: {payload} on topic {msg.topic}")
        # Log to a file
        with open("signals.log", "a") as f:
            f.write(f"{payload}\n")
        # Process ESP32 data
        data = json.loads(payload)
        value = data.get("value", 0)
        # Example logic: Send command based on value
        command = "ON" if value > 50 else "OFF"
        result = client.publish(COMMAND_TOPIC, command, qos=1)
        status = result[0]
        if status == 0:
            logger.info(f"Published command: {command} to {COMMAND_TOPIC}")
        else:
            logger.error(f"Failed to publish command to {COMMAND_TOPIC}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")

# Callback for connection failures
def on_connect_fail(client, userdata):
    logger.error("Connection to MQTT broker failed")

# Callback for disconnection
def on_disconnect(client, userdata, rc):
    if intentional_disconnect:
        logger.info("Intentional disconnection, no reconnection attempted")
        return
    logger.info(f"Unexpected disconnection with result code: {rc}")
    reconnect(client)

# Reconnection logic
def reconnect(client):
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
        logger.error("Reconnect failed after %d attempts. Exiting...", reconnect_count)

# Simple HTTP server for Render health checks
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Server is running")

def run_http_server():
    server_address = ("0.0.0.0", 8080)
    httpd = HTTPServer(server_address, HealthCheckHandler)
    logger.info("Starting HTTP server on port 8080...")
    httpd.serve_forever()

# Set up MQTT client
try:
    client = mqtt.Client(client_id=CLIENT_ID)
    client.username_pw_set(USERNAME, PASSWORD)
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
    exit(1)

# Connect to broker
try:
    logger.info(f"Connecting to {BROKER}:{PORT}")
    client.connect(BROKER, PORT, keepalive=60)
except Exception as e:
    logger.error(f"Connection failed: {e}")
    exit(1)

# Start MQTT loop and HTTP server
try:
    client.loop_start()  # Run MQTT loop in a background thread
    run_http_server()    # Run HTTP server in the main thread
except KeyboardInterrupt:
    logger.info("Keyboard interrupt received, shutting down")
    intentional_disconnect = True
    client.disconnect()
    client.loop_stop()
except Exception as e:
    logger.error(f"Error in server: {e}")
    intentional_disconnect = True
    client.disconnect()
    client.loop_stop()