import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { ArrowUp, ArrowDown, BrainCircuit, Activity, Clock, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onClose();
  };

  // --- STEP 1: FILTRI BIO-MIXER (ALTO) ---
  const renderStepOne = () => (
    <View style={[styles.hintWrapper, { top: insets.top + 210, alignSelf: 'center' }]}>
        <ArrowUp size={40} color="#fdcb6e" strokeWidth={3} style={styles.arrowUp} />
        
        <View style={[styles.hintBox, { borderColor: '#fdcb6e' }]}>
            <Text style={[styles.hintTitle, { color: '#fdcb6e' }]}>BIO-MIXER INTELLIGENTE</Text>
            <Text style={styles.hintText}>
              Questi non sono semplici pulsanti. Cliccando sui grammi, il sistema <Text style={styles.bold}>nasconde automaticamente</Text> le ricette che superano i tuoi macronutrienti residui.
              {'\n\n'}
              Usalo a fine giornata per trovare solo ciò che rientra nel tuo budget calorico.
            </Text>
        </View>

        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#fdcb6e' }]} onPress={handleNext}>
            <Text style={styles.nextBtnText}>AVANTI →</Text>
        </TouchableOpacity>
    </View>
  );

  // --- STEP 2: RICETTE E CARRELLO (CENTRO) ---
  const renderStepTwo = () => (
    <View style={[styles.hintWrapper, { top: height / 2 - 80, alignSelf: 'center' }]}>
        <View style={[styles.hintBox, { borderColor: '#00cec9' }]}>
            <Text style={[styles.hintTitle, { color: '#00cec9' }]}>RICETTE & SPESA</Text>
            <Text style={styles.hintText}>
              Ogni scheda ricetta è un gateway operativo. Cliccandoci potrai:
              {'\n'}• Leggere il protocollo di preparazione step-by-step.
              {'\n'}• Scalare le porzioni automaticamente.
              {'\n'}• <Text style={styles.bold}>Aggiungere gli ingredienti</Text> direttamente alla tua Lista Spesa con un solo tocco.
            </Text>
        </View>
        
        <ArrowDown size={40} color="#00cec9" strokeWidth={3} style={styles.arrowDown} />

        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#00cec9' }]} onPress={handleNext}>
            <Text style={styles.nextBtnText}>AVANTI →</Text>
        </TouchableOpacity>
    </View>
  );

  // --- STEP 3: NAVIGAZIONE (BASSO - LEGENDA CHIARA) ---
  const renderStepThree = () => (
    // Alzato di molto (bottom + 120) per non stare attaccato al bordo
    <View style={[styles.hintWrapper, { bottom: insets.bottom + 120, alignSelf: 'center' }]}>
        
        {/* Sfondo più chiaro (#252525) per contrasto massimo */}
        <View style={[styles.hintBox, { borderColor: '#a29bfe', padding: 20, backgroundColor: '#252525' }]}>
            <Text style={[styles.hintTitle, { color: '#a29bfe', textAlign: 'center', marginBottom: 20, fontSize: 18 }]}>
                ARSENALE DI NAVIGAZIONE
            </Text>

            {/* LEGENDA ICONE */}
            <View style={styles.legendRow}>
                <BrainCircuit size={24} color="#a29bfe" style={styles.legendIcon}/>
                <View style={{flex:1}}>
                    <Text style={[styles.legendTitle, {color:'#a29bfe'}]}>ADVISOR (AI)</Text>
                    <Text style={styles.legendDesc}>Chatbot medico-scientifico. Chiedi consigli su sintomi, digiuno e protocolli.</Text>
                </View>
            </View>

            <View style={styles.legendRow}>
                <Activity size={24} color="#00cec9" style={styles.legendIcon}/>
                <View style={{flex:1}}>
                    <Text style={[styles.legendTitle, {color:'#00cec9'}]}>TRACKER</Text>
                    <Text style={styles.legendDesc}>Il cuore dell'app. Logga i pasti, monitora i macro e visualizza il deficit calorico.</Text>
                </View>
            </View>

            <View style={styles.legendRow}>
                <Clock size={24} color="#fdcb6e" style={styles.legendIcon}/>
                <View style={{flex:1}}>
                    <Text style={[styles.legendTitle, {color:'#fdcb6e'}]}>STORICO</Text>
                    <Text style={styles.legendDesc}>Calendario delle performance. Analizza i giorni passati e i tuoi trend.</Text>
                </View>
            </View>

            <View style={styles.legendRow}>
                <ShoppingCart size={24} color="#ff7675" style={styles.legendIcon}/>
                <View style={{flex:1}}>
                    <Text style={[styles.legendTitle, {color:'#ff7675'}]}>CARRELLO</Text>
                    <Text style={styles.legendDesc}>Lista della spesa intelligente e libreria di eBook partner.</Text>
                </View>
            </View>

        </View>

        <ArrowDown size={40} color="#a29bfe" strokeWidth={3} style={styles.arrowDown} />

        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#fff', alignSelf: 'center', marginTop: 10 }]} onPress={handleNext}>
            <Text style={styles.nextBtnText}>TUTTO CHIARO, INIZIAMO</Text>
        </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <View style={[styles.counter, { top: insets.top + 10 }]}>
        <Text style={styles.counterText}>GUIDA {step} / 3</Text>
      </View>

      {step === 1 && renderStepOne()}
      {step === 2 && renderStepTwo()}
      {step === 3 && renderStepThree()}

    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, width: width, height: height,
    backgroundColor: 'rgba(0,0,0,0.92)', 
    zIndex: 99999,
    alignItems: 'center'
  },
  counter: {
    position: 'absolute', backgroundColor: '#333', 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8
  },
  counterText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  hintWrapper: { position: 'absolute', width: width - 40, alignItems: 'center' },
  
  hintBox: {
    backgroundColor: '#1a1a1a', // Un po' più chiaro del nero puro
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    width: '100%',
    shadowColor: '#000', shadowOffset: {width:0, height:6}, shadowOpacity:0.6, shadowRadius:12, elevation:12
  },
  
  hintTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10, letterSpacing: 1, textAlign: 'center' },
  hintText: { color: '#dfe6e9', fontSize: 14, lineHeight: 22, fontWeight: '500', textAlign: 'center' },
  bold: { color: '#fff', fontWeight: '900' },

  arrowUp: { marginBottom: 10 },
  arrowDown: { marginTop: 10 },

  nextBtn: { marginTop: 15, paddingHorizontal: 35, paddingVertical: 14, borderRadius: 30 },
  nextBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  // STILI LEGENDA (STEP 3) - Più spazio e luminosità
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 10 },
  legendIcon: { marginRight: 15, marginTop: 2 },
  legendTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  legendDesc: { color: '#ecf0f1', fontSize: 12, lineHeight: 16, fontWeight: '400' }, // Colore testo molto chiaro
});