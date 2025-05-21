import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import mqtt from 'mqtt';
import * as Location from 'expo-location';
import type { WebView as WebViewType } from 'react-native-webview';

export default function MapScreen() {
  const webviewRef = useRef<WebViewType>(null);
  const [coordinates, setCoordinates] = useState({ lat: 0, lon: 0 });
  const [address, setAddress] = useState('Fetching address...');
  const [battery, setBattery] = useState('--%');
  const [connected, setConnected] = useState(false);

  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>MapLibre</title>
        <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
        <link href="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css" rel="stylesheet" />
        <script src="https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js"></script>
        <style>
          html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          let marker;
          const map = new maplibregl.Map({
            container: 'map',
            style: 'https://demotiles.maplibre.org/style.json',
            center: [0, 0],
            zoom: 15
          });

          map.addControl(new maplibregl.NavigationControl());

          function updateMarker(lat, lon) {
            if (marker) {
              marker.setLngLat([lon, lat]);
            } else {
              marker = new maplibregl.Marker().setLngLat([lon, lat]).addTo(map);
            }
            map.setCenter([lon, lat]);
          }
        </script>
      </body>
    </html>
  `;

  useEffect(() => {
    const client = mqtt.connect('wss://ae9b16fe.ala.asia-southeast1.emqxsl.com:8084/mqtt', {
      username: 'BantayBike_Mobile',
      password: '12345678',
    });

    client.on('connect', () => {
      console.log('✅ Connected to MQTT');
      setConnected(true);
      client.subscribe('mobile/statistics');
    });

    client.on('message', async (topic, message) => {
      if (topic === 'mobile/statistics') {
        try {
          const data = JSON.parse(message.toString());
          const { gps_lat, gps_lon, battery_level } = data;

          const lat = parseFloat(gps_lat);
          const lon = parseFloat(gps_lon);
          setCoordinates({ lat, lon });
          setBattery(`${battery_level}%`);

          // Reverse geocode
          const addr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (addr && addr[0]) {
            const locationStr = `${addr[0].name || ''}, ${addr[0].city || ''}`;
            setAddress(locationStr);
          }
        } catch (err) {
          console.error('❌ Error parsing MQTT data:', err);
        }
      }
    });

    return () => {
      client.end();
    };
  }, []);

  // Inject JS to update map marker
  useEffect(() => {
    if (webviewRef.current && coordinates.lat !== 0 && coordinates.lon !== 0) {
      const jsCode = `updateMarker(${coordinates.lat}, ${coordinates.lon}); true;`;
      webviewRef.current.injectJavaScript(jsCode);
    }
  }, [coordinates]);

  return (
    <View style={styles.container}>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>📍 {address}</Text>
        <Text style={styles.infoText}>🔋 Battery: {battery}</Text>
        <Text style={styles.infoText}>📶 MQTT: {connected ? 'Connected' : 'Disconnected'}</Text>
      </View>

      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        javaScriptEnabled={true}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoBox: {
    backgroundColor: '#00573f',
    padding: 10,
  },
  infoText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 2,
  },
  map: {
    flex: 1,
  },
});
