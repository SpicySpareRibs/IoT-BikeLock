import paho.mqtt.client as mqtt
import ssl
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# EMQX Serverless credentials
BROKER = "xxx.emqx.cloud"
PORT = 8883
CLIENT_ID = "python-server"
USERNAME = "your_username"
PASSWORD = "your_password"
TOPIC = "esp32/signals"

# Path to CA certificate
CA_CERT = "emqxsl-ca.crt"

# Callback when the client connects to the broker
def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        logger.info("Connected to MQTT broker")
        client.subscribe(TOPIC, qos=1)
        logger.info(f"Subscribed to {TOPIC}")
    else:
        logger.error(f"Connection failed with code {reason_code}")

# Callback when a message is received
def on_message(client, userdata, msg, properties=None):
    try:
        payload = msg.payload.decode('utf-8')
        logger.info(f"Received: {payload} on topic {msg.topic}")
        # Log to a file
        with open("signals.log", "a") as f:
            f.write(f"{payload}\n")
        # Add custom logic here, e.g., save to a database or trigger actions
    except Exception as e:
        logger.error(f"Error processing message: {e}")

# Callback for connection failures
def on_connect_fail(client, userdata):
    logger.error("Connection to MQTT broker failed")

# Set up MQTT client
try:
    # Use modern callback API if available
    client = mqtt.Client(client_id=CLIENT_ID, callback_api_version=mqtt.CallbackAPIVersion.VERSION2)  # type: ignore
except AttributeError:
    # Fallback to legacy API for older paho-mqtt versions
    logger.warning("CallbackAPIVersion not available, using legacy API")
    client = mqtt.Client(client_id=CLIENT_ID)
except Exception as e:
    logger.error(f"Failed to initialize MQTT client: {e}")
    exit(1)

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

# Connect to broker
try:
    logger.info(f"Connecting to {BROKER}:{PORT}")
    client.connect(BROKER, PORT, keepalive=60)
except Exception as e:
    logger.error(f"Connection failed: {e}")
    exit(1)

# Start the loop to process messages
try:
    client.loop_forever()
except KeyboardInterrupt:
    logger.info("Shutting down")
    client.disconnect()
except Exception as e:
    logger.error(f"Error in MQTT loop: {e}")
    client.disconnect()