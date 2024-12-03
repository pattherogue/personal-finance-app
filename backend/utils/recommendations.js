// backend/utils/recommendations.js

// Helper function to find the top expense category
const findTopExpenseCategory = (transactions) => {
  // Group expenses by category
  const categoryTotals = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

  // Find the category with the highest total expense
  const topCategory = Object.keys(categoryTotals).reduce((a, b) => 
    categoryTotals[a] > categoryTotals[b] ? a : b
  );

  return topCategory;
};

// Function to generate recommendations
const generateRecommendations = (transactions, monthlyBudget) => {
  const totalSpent = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
  
  const surplus = monthlyBudget - totalSpent;
  
  if (surplus > 0) {
    return {
      type: 'positive',
      message: `You have a surplus of $${surplus}. Recommend: 70% to savings, 30% to emergency fund.`
    };
  } else {
    const topExpenseCategory = findTopExpenseCategory(transactions);
    return {
      type: 'warning',
      message: `Over budget by $${Math.abs(surplus)}. Consider reducing spending in ${topExpenseCategory}.`
    };
  }
};

module.exports = generateRecommendations;
