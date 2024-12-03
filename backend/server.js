// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware for security
const securityMiddleware = (req, res, next) => {
  // Basic input validation and sanitization
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim().replace(/[<>]/g, '');
      }
    });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

app.use(cors());
app.use(express.json());
app.use(securityMiddleware);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Schemas
const transactionSchema = new mongoose.Schema({
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: String,
  date: { type: Date, default: Date.now }
});

const budgetSchema = new mongoose.Schema({
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, default: 'expense' }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);

// Data Processing Utilities
const dataProcessor = {
  cleanData: (data) => {
    return {
      ...data,
      amount: parseFloat(data.amount),
      category: data.category.toLowerCase().trim(),
      date: new Date(data.date || Date.now())
    };
  },

  validateTransaction: (data) => {
    const errors = [];
    if (!data.amount || data.amount <= 0) errors.push('Invalid amount');
    if (!data.category) errors.push('Category is required');
    if (!['income', 'expense'].includes(data.type)) errors.push('Invalid type');
    return { isValid: errors.length === 0, errors };
  }
};

// Helper Functions
const calculateAccuracy = (predicted, actual) => {
  if (actual === 0) return 0;
  const accuracy = (1 - Math.abs(predicted - actual) / actual) * 100;
  return Math.min(100, Math.max(0, accuracy));
};

const getMonthlyData = (transactions) => {
  return transactions.reduce((acc, t) => {
    const monthYear = new Date(t.date).toISOString().slice(0, 7);
    if (!acc[monthYear]) acc[monthYear] = { expenses: 0, income: 0 };
    if (t.type === 'expense') {
      acc[monthYear].expenses += t.amount;
    } else {
      acc[monthYear].income += t.amount;
    }
    return acc;
  }, {});
};

// Machine Learning Utilities
const mlUtils = {
  predictNextMonthSpending: (transactions) => {
    if (transactions.length < 3) return null;

    const monthlyData = getMonthlyData(transactions);
    const months = Object.keys(monthlyData).sort();
    const recentMonths = months.slice(-3);
    const recentExpenses = recentMonths.map(month => monthlyData[month].expenses);
    
    const prediction = recentExpenses.reduce((a, b) => a + b, 0) / 3;
    const confidence = calculateConfidence(recentExpenses);

    return { prediction, confidence };
  },

  generateRecommendations: async (transactions, budgets) => {
    const monthlyData = getMonthlyData(transactions);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentSpending = monthlyData[currentMonth]?.expenses || 0;
    const recommendations = [];

    // Check budget compliance
    for (const budget of budgets) {
      const categoryTransactions = transactions.filter(t => 
        t.category === budget.category && 
        t.type === 'expense' &&
        t.date.toISOString().slice(0, 7) === currentMonth
      );
      
      const categorySpending = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      if (categorySpending > budget.amount) {
        recommendations.push({
          category: budget.category,
          message: `Reduce spending in ${budget.category} by $${(categorySpending - budget.amount).toFixed(2)}`,
          priority: 'high'
        });
      }
    }

    // Add general savings recommendation if spending is high
    const prevMonth = months[months.length - 2];
    if (prevMonth && currentSpending > monthlyData[prevMonth].expenses * 1.1) {
      recommendations.push({
        category: 'general',
        message: `Overall spending is higher than last month. Consider reducing expenses.`,
        priority: 'medium'
      });
    }

    return recommendations;
  }
};

function calculateConfidence(data) {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));
}

// Routes

// Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { startDate, endDate, category, type } = req.query;
    let query = {};
    
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (category) query.category = category;
    if (type) query.type = type;

    const transactions = await Transaction.find(query).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const validation = dataProcessor.validateTransaction(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const cleanedData = dataProcessor.cleanData(req.body);
    const transaction = new Transaction(cleanedData);
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Budgets
app.get('/api/budgets', async (req, res) => {
  try {
    const budgets = await Budget.find();
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const budget = new Budget(dataProcessor.cleanData(req.body));
    await budget.save();
    res.status(201).json(budget);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Analysis and Predictions
app.get('/api/analysis', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 });
    const budgets = await Budget.find();

    const prediction = mlUtils.predictNextMonthSpending(transactions);
    const recommendations = await mlUtils.generateRecommendations(transactions, budgets);

    res.json({
      prediction,
      recommendations,
      monthlyTrends: getMonthlyData(transactions)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accuracy Evaluation
app.get('/api/accuracy', async (req, res) => {
  try {
    const transactions = await Transaction.find({type: 'expense'}).sort({ date: 1 });
    const monthlyData = getMonthlyData(transactions);
    const months = Object.keys(monthlyData).sort();
    
    const predictions = [];
    let totalAccuracy = 0;
    let predictionCount = 0;

    // Calculate predictions for each month using previous 3 months
    for (let i = 3; i < months.length; i++) {
      const prevThreeMonths = months.slice(i-3, i);
      const predicted = prevThreeMonths.reduce((sum, month) => 
        sum + monthlyData[month].expenses, 0) / 3;
      const actual = monthlyData[months[i]].expenses;
      
      const accuracy = calculateAccuracy(predicted, actual);
      
      predictions.push({
        month: months[i],
        predicted: Math.round(predicted * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        accuracy: Math.round(accuracy * 100) / 100
      });

      totalAccuracy += accuracy;
      predictionCount++;
    }

    res.json({
      predictions: predictions.slice(-3), // Only send last 3 predictions
      averageAccuracy: predictionCount > 0 ? Math.round(totalAccuracy / predictionCount) : 0,
      totalPredictions: predictionCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// System Health Monitoring
app.get('/api/system/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1;
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: {
        connected: dbStatus,
        collections: Object.keys(mongoose.connection.collections).length
      },
      system: {
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));