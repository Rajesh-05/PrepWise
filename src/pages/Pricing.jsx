import React, { useState } from 'react';
import '../styles/Pricing.css';

const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: 'Get started and explore the essentials.',
    icon: '🎓',
    features: [
      '3 resume evaluations per month',
      'Basic job finder access',
      'Interview prep questions (limited)',
      'Standard resume builder',
    ],
    notIncluded: [
      'PDF downloads',
      'Priority support',
      'Advanced filters',
    ],
    button: 'Get Started Free',
    highlight: '',
    isPopular: false,
  },
  {
    name: 'Starter',
    monthlyPrice: 5,
    yearlyPrice: 50,
    description: 'Best for students actively job hunting.',
    icon: '🚀',
    features: [
      '20 resume evaluations per month',
      'Advanced job finder filters',
      'Unlimited interview practice',
      'Premium resume templates',
      'Download resumes as PDF',
    ],
    notIncluded: [
      'Priority support',
    ],
    button: 'Start with Starter',
    highlight: 'Save 17% annually',
    isPopular: true,
  },
  {
    name: 'Unlimited',
    monthlyPrice: 15,
    yearlyPrice: 150,
    description: 'Full access. Zero limits. Priority help.',
    icon: '⚡',
    features: [
      'Unlimited resume evaluations',
      'Unlimited job finder access',
      'Unlimited interview practice',
      'All premium resume templates',
      'PDF downloads always on',
      'Priority support',
      'Early access to new features',
    ],
    notIncluded: [],
    button: 'Go Unlimited',
    highlight: 'Save 17% annually',
    isPopular: false,
  },
];

const Pricing = () => {
  const [selected, setSelected] = useState('');
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'yearly'
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handlePlanSelect = async (planName) => {
    setSelected(planName);
    setSubmitting(true);
    setMessage('');
    const tier = planName.toLowerCase();
    const now = new Date();
    const start_date = now.toISOString();
    const end_date = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
    const status = 'active';
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ tier, start_date, end_date, status })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(`✓ ${planName} plan activated successfully!`);
      } else {
        setMessage(data.error || 'Failed to update subscription.');
      }
    } catch {
      setMessage('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="pricing-page">
      {/* Compact billing toggle header */}
      <div className="pricing-toggle-bar">
        <h2 className="pricing-toggle-title">Choose Your Plan</h2>
        <div className="billing-toggle">
          <button
            className={`toggle-btn ${billing === 'monthly' ? 'active' : ''}`}
            onClick={() => setBilling('monthly')}
          >Monthly</button>
          <button
            className={`toggle-btn ${billing === 'yearly' ? 'active' : ''}`}
            onClick={() => setBilling('yearly')}
          >
            Yearly
            <span className="save-chip">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="pricing-cards">
        {plans.map((plan) => {
          const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
          const isSelected = selected === plan.name;
          return (
            <div
              key={plan.name}
              className={`pricing-card${plan.isPopular ? ' popular' : ''}${isSelected ? ' selected' : ''}`}
            >
              {plan.isPopular && <div className="popular-badge">⭐ Most Popular</div>}

              <div className="plan-icon">{plan.icon}</div>
              <div className="plan-name">{plan.name}</div>

              <div className="plan-price-row">
                {price === 0 ? (
                  <span className="plan-price">Free</span>
                ) : (
                  <>
                    <span className="plan-price">${price}</span>
                    <span className="plan-period">/{billing === 'yearly' ? 'yr' : 'mo'}</span>
                  </>
                )}
              </div>

              {plan.highlight && billing === 'yearly' && (
                <div className="plan-highlight">{plan.highlight}</div>
              )}

              <p className="plan-desc">{plan.description}</p>

              <ul className="plan-features">
                {plan.features.map(f => (
                  <li key={f} className="feature-item included">
                    <span className="check">✓</span> {f}
                  </li>
                ))}
                {plan.notIncluded.map(f => (
                  <li key={f} className="feature-item not-included">
                    <span className="cross">✗</span> {f}
                  </li>
                ))}
              </ul>

              <button
                className={`plan-btn${plan.isPopular ? ' primary' : ''}${isSelected ? ' selected-btn' : ''}`}
                onClick={() => handlePlanSelect(plan.name)}
                disabled={submitting && isSelected}
              >
                {isSelected
                  ? (submitting ? 'Activating...' : '✓ Current Plan')
                  : plan.button}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feedback message */}
      {message && (
        <div className={`pricing-message ${message.startsWith('✓') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* FAQ strip */}
      <div className="pricing-faq">
        <div className="faq-item">
          <span className="faq-icon">🔄</span>
          <div>
            <strong>Cancel anytime</strong>
            <p>No contracts. Cancel with one click.</p>
          </div>
        </div>
        <div className="faq-item">
          <span className="faq-icon">🔒</span>
          <div>
            <strong>Secure payment</strong>
            <p>Your data is always protected.</p>
          </div>
        </div>
        <div className="faq-item">
          <span className="faq-icon">⬆️</span>
          <div>
            <strong>Upgrade freely</strong>
            <p>Switch plans at any time.</p>
          </div>
        </div>
        <div className="faq-item">
          <span className="faq-icon">🎯</span>
          <div>
            <strong>Student-focused</strong>
            <p>Built for campus placement & beyond.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
