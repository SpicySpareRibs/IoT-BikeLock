import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import type { WebView as WebViewType } from 'react-native-webview';
import * as maptilersdk from '@maptiler/sdk';

export default function MapScreen() {
  const webviewRef = useRef<WebViewType>(null);
  const [coordinates, setCoordinates] = useState({ lat: 0, lon: 0 });
  const [address, setAddress] = useState('Fetching address...');
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
          html, body, #map {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>

        <script>
          const map = new maplibregl.Map({
            container: 'map',
            style: 'https://api.maptiler.com/maps/streets/style.json?key=yi6hezjggNOBaFN0ZLHl',
            center: [121.06875036169166, 14.648731271995985],
            zoom: 20
          });

          const marker = new maptilersdk.Marker()
            .setLngLat([121.06875036169166, 14.648731271995985])
            .addTo(map);

          map.addControl(new maplibregl.NavigationControl());
        </script>
      </body>
    </html>
  `;

  // useEffect(() => {
  //   const client = mqtt.connect('wss://ae9b16fe.ala.asia-southeast1.emqxsl.com:8084/mqtt', {
  //     username: 'BantayBike_Mobile',
  //     password: '12345678',
  //   });

  //   client.on('connect', () => {
  //     console.log('Connected to MQTT');
  //     setConnected(true);
  //     client.subscribe('mobile/statistics');
  //   });

  //   client.on('message', async (topic, message) => {
  //     if (topic === 'mobile/statistics') {
  //       try {
  //         const data = JSON.parse(message.toString());

  //         //Add log to inspect raw JSON data
  //         console.log('Parsed MQTT message:', data);

  //         const { gps_lat, gps_lon, battery_level } = data;

  //         const lat = parseFloat(gps_lat);
  //         const lon = parseFloat(gps_lon);

  //         console.log(`Parsed coordinates: Latitude=${lat}, Longitude=${lon}, Battery=${battery_level}`);

  //         if (isNaN(lat) || isNaN(lon)) {
  //           console.warn('Invalid coordinates received');
  //           return;
  //         }

  //         setCoordinates({ lat, lon });

  //         const { status } = await Location.requestForegroundPermissionsAsync();
  //         if (status !== 'granted') {
  //           console.warn('Location permission denied');
  //           setAddress('Permission denied');
  //           return;
  //         }

  //         const addr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
  //         if (addr && addr.length > 0) {
  //           const { name, street, city, region, country } = addr[0];
  //           const locationStr = [name, street, city, region, country].filter(Boolean).join(', ');
  //           setAddress(locationStr);
  //         } else {
  //           setAddress('Unknown location');
  //         }
  //       } catch (err) {
  //         console.error('Error parsing MQTT or geocoding:', err);
  //         setAddress('Error fetching address');
  //       }
  //     }
  //   });


  //   return () => {
  //     client.end();
  //   };
  // }, []);



  useEffect(() => {
    // test coordinates
    const testLat = 14.648731271995985;
    const testLon = 121.06875036169166;
    setCoordinates({ lat: testLat, lon: testLon });
    setAddress('Alumni Engineers Centennial Hall, UP Diliman');
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>{address}</Text>
        <Text style={styles.infoText}>MQTT: {connected ? 'Connected' : 'Disconnected'}</Text>
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
