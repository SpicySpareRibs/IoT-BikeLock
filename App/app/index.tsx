import { Buffer } from 'buffer';
import mqtt from 'mqtt';
import * as Location from 'expo-location';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View, Pressable, Modal, Button } from 'react-native';

global.Buffer = Buffer;

let mqttClient: mqtt.MqttClient | null = null;

export default function HomeScreen() {
  // const [locationText, setLocationText] = useState('Fetching...');
  // const [batteryLevel, setBatteryLevel] = useState('N/A');
  // const [isLocked, setIsLocked] = useState(true);

  // const [isAlertMode, setIsAlertMode] = useState(false);
  // const [alertVisible, setAlertVisible] = useState(false);
  // const [alertHeader, setAlertHeader] = useState('');
  // const [alertBody, setAlertBody] = useState('');
  // const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  const [lowBatteryVisible, setLowBatteryVisible] = useState(true);


  const [locationText, setLocationText] = useState('123 Anywhere St.\nQuezon City');
  const [batteryLevel, setBatteryLevel] = useState('20%');
  const [isLocked, setIsLocked] = useState(true);

  const [isAlertMode, setIsAlertMode] = useState(true);
  const [alertVisible, setAlertVisible] = useState(true);
  const [alertHeader, setAlertHeader] = useState('Cord Cut Detected!');
  const [alertBody, setAlertBody] = useState('Your BantayBike lock cord was cut. Your bike may be at risk. Real-time location tracking has been activated.');
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const startScale = useRef(new Animated.Value(0.8)).current;
  const alertBoxScale = useRef(new Animated.Value(1)).current;
  const locationBoxScale = useRef(new Animated.Value(1)).current;


  const [fontsLoaded] = useFonts({
    'worksans-regular': require('../assets/fonts/worksans_regular.ttf'),
    'worksans-semibold': require('../assets/fonts/worksans_semibold.ttf'),
    'worksans-bold': require('../assets/fonts/worksans_semibold.ttf'),
  });

  useEffect(() => {
    mqttClient = mqtt.connect('wss://ae9b16fe.ala.asia-southeast1.emqxsl.com:8084/mqtt', {
      username: 'BantayBike_Mobile',
      password: '12345678',
    });

    mqttClient.on('connect', () => {
      console.log('Connected');
      mqttClient?.subscribe('mobile/statistics', (err) => {
        if (!err) console.log('Subscribed to mobile/statistics');
      });
    });

    mqttClient.on('message', async (topic, message) => {
      if (topic === 'mobile/statistics') {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received:', data);
          const { gps_lat, gps_lon, battery_level, state, reason } = data;

          setIsAlertMode(state === 'alert');

          if (state === 'alert') {
            if (reason === 'wire') {
              setAlertHeader('Cord Cut Detected!');
              setAlertBody('Your BantayBike lock cord was cut. Your bike may be at risk. Real-time location tracking has been activated.');
              setAlertVisible(true);
            } else if (reason === 'gps') {
              setAlertHeader('Movement Detected!');
              setAlertBody("Your bike's location changed significantly while locked. This may indicate theft. Tracking is now live.");
              setAlertVisible(true);
            } else if (reason === 'timeout') {
              setAlertHeader('Device Timeout!');
              setAlertBody('The server hasn’t received updates from your BantayBike lock for over 30 seconds. Please check its status.');
              setAlertVisible(true);
            }
          } else {
            setAlertVisible(false);
          }

          const addr = await Location.reverseGeocodeAsync({
            latitude: parseFloat(gps_lat),
            longitude: parseFloat(gps_lon),
          });

          if (addr && addr[0]) {
            setLocationText(`${addr[0].name || ''} ${addr[0].city || ''}`);
          }

          if (battery_level <= 20) {
            setLowBatteryVisible(true);
          }

          setBatteryLevel(`${battery_level}%`);
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      }
    });

    return () => {
      mqttClient?.end();
      mqttClient = null;
    };
  }, [locationPermissionGranted]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(startScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
      }),
    ]).start();
  }, []);

  const handlePressAnimation = (scaleRef: Animated.Value, callback?: () => void) => {
      Animated.sequence([
        Animated.timing(scaleRef, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleRef, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (callback) callback();
      });
    };

  const handleToggleLock = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    


    const newState = isLocked ? 'Unlock' : 'Lock';
    setIsLocked(!isLocked);

    const tempClient = mqtt.connect('wss://ae9b16fe.ala.asia-southeast1.emqxsl.com:8084/mqtt', {
      username: 'BantayBike_Mobile',
      password: '12345678',
    });

    tempClient.on('connect', () => {
      tempClient.publish('server/request/mobile', JSON.stringify({ state: newState }));
      tempClient.end();
    });
  };

  const batteryPercentage = parseInt(batteryLevel.replace('%', ''));
  let batteryIcon = require('../assets/images/fullbattery.svg');

  if (batteryPercentage <= 20) {
    batteryIcon = require('../assets/images/lowbattery.svg');
  } else if (batteryPercentage <= 60) {
    batteryIcon = require('../assets/images/halfbattery.svg');
  } 

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Image source={require('../assets/images/BantayBike_logo.svg')} style={styles.logoIcon} />
        <Text style={styles.header}>BantayBike</Text>
      </View>

      <View style={styles.batteryContainer}>
        <Image source={batteryIcon} style={styles.batteryIcon} />
        <Text style={styles.batteryText}>{batteryLevel}</Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: startScale }] }}>
        <Pressable onPress={handleToggleLock}>
          <LinearGradient
            colors={['#E9EBE8', '#989FCB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.lockCircle}
          >
            <Animated.Image
              source={
                isLocked
                  ? require('../assets/images/locked.svg')
                  : require('../assets/images/unlocked.svg')
              }
              style={[styles.lockIcon, { transform: [{ scale: scaleAnim }] }]}
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <Text style={styles.lockText}>{isLocked ? 'locked' : 'unlocked'}</Text>
      <Text style={styles.statusText}>
        location status: <Text style={isAlertMode ? styles.statusRisk : styles.statusSafe}>
          {isAlertMode ? 'at risk' : 'safe'}
        </Text>
      </Text>


      {isAlertMode && (
        <Pressable
          onPress={() =>
            handlePressAnimation(alertBoxScale, () => {
              setAlertVisible(true);
            })
          }
        >
          <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: startScale }],
          }}
        >
          <Animated.View
            style={[
              { transform: [{ scale: alertBoxScale }] },
            ]}
          >
            <LinearGradient
              colors={['#29274C', '#A50136']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.AlertModeBox}
            >
              <View style={styles.AlertmodeContainer}>
                <Image source={require('../assets/images/alert_white.svg')} style={styles.AlertIcon} />
                <Text style={styles.AlertLabel}> Alert Mode</Text>
              </View>
            </LinearGradient>
          </Animated.View>
          </Animated.View>
        </Pressable>
      )}


      <Pressable onPress={() => handlePressAnimation(locationBoxScale)}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: startScale }],
          }}
        >
          <Animated.View style={{ transform: [{ scale: locationBoxScale }] }}>
            <LinearGradient
              colors={['#E9EBE8', '#989FCB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.locationBox}
            >
              <View style={styles.locationHeader}>
                <View style={styles.locationIconandText}>
                  <Image source={require('../assets/images/location_normal.svg')} style={styles.locationIcon} />
                  <Text style={styles.locationLabel}> Location</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </View>
              <Text style={styles.locationAddress}>{locationText}</Text>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </Pressable>


      <Modal
        visible={alertVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Image
              source={require('../assets/images/alert_black.svg')}
              style={styles.alertImage}
            />
            <Text style={styles.alertHeader}>{alertHeader}</Text>
            <Text style={styles.alertBody}>{alertBody}</Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.dismissButton} onPress={() => setAlertVisible(false)}>
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </Pressable>

              <Pressable
                style={styles.trackButton}
                onPress={() => {
                  setAlertVisible(false);
                  // Navigate to location
                }}
              >
                <Text style={styles.trackButtonText}>Track</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={lowBatteryVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLowBatteryVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Image
              source={require('../assets/images/lowbattery.svg')}
              style={styles.alertImage}
            />
            <Text style={styles.alertHeader}>Low Battery – Charge Soon</Text>
            <Text style={styles.alertBody}>
              Your BantayBike lock battery is low. Please recharge to maintain security features.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable style={styles.dismissButton} onPress={() => setLowBatteryVisible(false)}>
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 60,
  },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },

  logoIcon: {
    width: 35,
    height: 28,
    marginRight: 5,
  },

  header: {
    fontFamily: 'worksans-bold',
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },

  batteryContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },

  batteryIcon: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },

  batteryText: {
    fontFamily: 'worksans-semibold',
    fontSize: 16,
    fontWeight: '600',
  },

  lockCircle: {
    width: 203,
    height: 203,
    borderRadius: 264,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },

  lockIcon: {
    width: 128,
    height: 128,
  },

  lockText: {
    fontFamily: 'worksans-bold',
    fontSize: 20,
    color: '#333',
    marginBottom: 4,
  },

  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 40,
  },

  statusSafe: {
    fontFamily: 'worksans-semibold',
    fontWeight: 'bold',
    color: '#333',
  },

  AlertModeBox: {
    width: 333,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },

  AlertmodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },

  AlertIcon: {
    width: 20,
    height: 20,
  },

  AlertLabel: {
    fontFamily: 'worksans-bold',
    fontSize: 16,
    color: '#fff',
  },

  locationBox: {
    width: 333,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  locationLabel: {
    fontFamily: 'worksans-bold',
    fontSize: 13,
    color: '#444',
  },

  arrow: {
    fontSize: 18,
    color: '#444',
  },

  locationAddress: {
    fontFamily: 'worksans-regular',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    color: '#222',
  },

  locationIcon: {
    width: 13,
    height: 13,
    opacity: 0.7,
  },

  toggleContainer: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  toggleLabel: {
    fontFamily: 'worksans-regular',
    fontSize: 14,
    color: '#444',
  },

  locationIconandText: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  modalContainer: {
    backgroundColor: '#E4E4E4',
    borderRadius: 20,
    padding: 24,
    width: 349, 
    height: 284,
    alignItems: 'center',
    justifyContent: 'center'
  },
  alertImage: {
    width: 40,
    height: 40,
    marginBottom: 12,
  },
  alertHeader: {
    fontFamily: 'worksans-bold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  alertBody: {
    fontFamily: 'worksans-regular',
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10, 
  },
  dismissButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#6D6BF1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    width: 88
  },
  dismissButtonText: {
    color: '#6D6BF1',
    fontFamily: 'worksans-semibold',
  },
  trackButton: {
    flex: 1,
    backgroundColor: '#6D6BF1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    width: 88
  },
  trackButtonText: {
    color: 'white',
    fontFamily: 'worksans-semibold',

  },

  statusRisk: {
    fontFamily: 'worksans-semibold',
    fontWeight: 'bold',
    color: '#A50136',
  },


});

