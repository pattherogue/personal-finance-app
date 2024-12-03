// backend/utils/dataProcessor.js
const processData = {
  cleanData: (data) => {
    return data.map(entry => ({
      amount: parseFloat(entry.amount),
      category: entry.category.toLowerCase().trim(),
      date: new Date(entry.date),
      type: entry.type.toLowerCase(),
      description: entry.description.trim()
    }));
  },

  validateData: (data) => {
    const errors = [];
    if (data.amount <= 0) errors.push('Amount must be greater than zero.');
    if (!['income', 'expense'].includes(data.type)) errors.push('Type must be "income" or "expense".');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Simple ML for spending prediction using moving average
  predictNextMonthSpending: (transactions) => {
    const last3Months = transactions
      .filter(t => t.type === 'expense')
      .slice(-3)
      .reduce((acc, curr) => acc + curr.amount, 0) / 3;
    
    return Math.round(last3Months * 100) / 100;
  }
};

module.exports = processData;
