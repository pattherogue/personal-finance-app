// backend/utils/mlModel.js
const calculateSpendingPrediction = (historicalData) => {
    // Simple linear regression for spending prediction
    const xValues = historicalData.map((_, i) => i);
    const yValues = historicalData.map(d => d.amount);
    
    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((a, b, i) => a + b * yValues[i], 0);
    const sumXX = xValues.reduce((a, b) => a + b * b, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const nextPrediction = slope * (n + 1) + intercept;
    
    return Math.max(0, Math.round(nextPrediction * 100) / 100);
  };