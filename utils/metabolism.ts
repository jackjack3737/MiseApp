// utils/metabolism.ts

export const calculateDynamicBMR = (weight: number, height: number, age: number, isMale: boolean) => {
  // Formula di Mifflin-St Jeor
  let bmr = 10 * weight + 6.25 * height - 5 * age;
  
  // Aggiustamento sesso
  bmr = isMale ? bmr + 5 : bmr - 161;

  // Moltiplicatore attività basale (sedentario)
  // Questo è il punto di partenza prima dei bonus passi/allenamento
  return Math.round(bmr * 1.2); 
};