import React from 'react';
import { useState } from 'react';
import '../styles/Pricing.css';

const plans = [
  {
    name: 'Free',
    price: '$0',
    yearly: '',
    description: 'Get started with CareerAI for free. Limited access to core features.',
    features: [
      '3 resume evaluations per month',
      'Basic job finder access',
      'Limited interview prep questions',
      'Access to standard resume builder',
    ],
    button: 'Choose Free',
    highlight: '',
    isPopular: false,
  },
  {
    name: 'Starter',
    price: '$5/month',
    yearly: '$50/year',
    description: 'Unlock more resume tools, templates, and job search features.',
    features: [
      '20 resume evaluations per month',
      'Advanced job finder filters',
      'Unlimited interview prep',
      'Access to premium resume templates',
      'Download resumes as PDF',
    ],
    button: 'Choose Starter',
    highlight: 'Save 17% with annual billing',
    isPopular: true,
  },
  {
    name: 'Unlimited',
    price: '$15/month',
    yearly: '$150/year',
    description: 'Full access to all CareerAI features, templates, and priority support.',
    features: [
      'Unlimited resume evaluations',
      'Unlimited job finder access',
      'Unlimited interview prep',
      'All premium resume templates',
      'Priority support',
      'Early access to new features',
    ],
    button: 'Choose Unlimited',
    highlight: 'Save 17% with annual billing',
    isPopular: false,
  },
];

const Pricing = () => {
  const [selected, setSelected] = useState('Free');
  return (
    <div className="pricing-page">
      <h2 className="pricing-title">Choose Your Plan</h2>
      <div className="pricing-cards">
        {plans.map((plan) => (
          <div
            className={`pricing-card${selected === plan.name ? ' selected' : ''}`}
            key={plan.name}
            onClick={() => setSelected(plan.name)}
            style={selected === plan.name ? {
              cursor: 'pointer',
              border: '3px solid #10b981',
              boxShadow: '0 4px 24px rgba(16,185,129,0.18)',
              background: 'linear-gradient(90deg, #e0f7fa 0%, #f3f4fa 100%)'
            } : {
              cursor: 'pointer',
              border: '2px solid #e0e7ff',
              boxShadow: '0 2px 16px rgba(99,102,241,0.08)',
              background: '#fff'
            }}
          >
            <div className="plan-header">
              <h3>{plan.name}</h3>
              <div className="plan-price">{plan.price}</div>
              {plan.yearly && <div className="plan-yearly">{plan.yearly}</div>}
              {plan.highlight && <div className="plan-highlight">{plan.highlight}</div>}
            </div>
            <div className="plan-desc">{plan.description}</div>
            <ul className="plan-features">
              {plan.features.map(f => <li key={f}>{f}</li>)}
            </ul>
            <button
              className="plan-btn"
              style={selected === plan.name ? {
                background: 'linear-gradient(90deg, #10b981 0%, #6366f1 100%)',
                color: '#fff',
                fontWeight: 700
              } : undefined}
              disabled={selected === plan.name}
            >
              {selected === plan.name ? '✔ Selected' : plan.button}
            </button>
          </div>
        ))}
      </div>
      <div style={{textAlign: 'center', marginTop: '2rem', color: '#10b981', fontWeight: 600, fontSize: '1.15rem'}}>
        {selected === 'Free' && 'You have selected the Free plan. Enjoy limited access to CareerAI features.'}
        {selected === 'Starter' && 'You have selected the Starter plan. Unlock more resume tools and templates.'}
        {selected === 'Unlimited' && 'You have selected the Unlimited plan. Enjoy full access and priority support!'}
      </div>
    </div>
  );
};

export default Pricing;
