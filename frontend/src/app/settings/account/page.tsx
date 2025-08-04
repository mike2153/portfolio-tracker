'use client';

import { useState } from 'react';
import { CreditCard, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  email?: string;
  isDefault: boolean;
  expiryDate?: string;
}

export default function AccountSettingsPage() {
  const { addToast } = useToast();
  const [showAddPayment, setShowAddPayment] = useState(false);
  
  // Mock data - in production this would come from API
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: '1',
      type: 'card',
      last4: '4242',
      brand: 'Visa',
      isDefault: true,
      expiryDate: '12/2024'
    }
  ]);

  const [billingHistory] = useState([
    { id: '1', date: '2024-01-01', amount: 9.99, status: 'paid', invoice: '#INV-001' },
    { id: '2', date: '2023-12-01', amount: 9.99, status: 'paid', invoice: '#INV-002' },
  ]);

  const handleSetDefault = (methodId: string) => {
    setPaymentMethods(prev => prev.map(method => ({
      ...method,
      isDefault: method.id === methodId
    })));
    
    addToast({
      type: 'success',
      title: 'Default Payment Method Updated',
      message: 'Your default payment method has been changed.'
    });
  };

  const handleRemoveMethod = (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (method?.isDefault) {
      addToast({
        type: 'error',
        title: 'Cannot Remove Default',
        message: 'Please set another payment method as default first.'
      });
      return;
    }

    setPaymentMethods(prev => prev.filter(m => m.id !== methodId));
    addToast({
      type: 'success',
      title: 'Payment Method Removed',
      message: 'The payment method has been removed from your account.'
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Account & Billing</h2>
      
      {/* Subscription Status */}
      <div className="mb-8 p-4 bg-transparent border border-[#30363D] rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Current Plan: Professional</h3>
            <p className="text-[#8B949E]">$9.99/month • Next billing date: February 1, 2024</p>
          </div>
          <button className="px-4 py-2 border border-[#30363D] rounded-md text-[#8B949E] hover:text-white hover:bg-[#30363D]/50">
            Change Plan
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Payment Methods</h3>
          <button
            onClick={() => setShowAddPayment(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Payment Method
          </button>
        </div>

        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 bg-transparent border border-[#30363D] rounded-lg"
            >
              <div className="flex items-center gap-4">
                <CreditCard className="h-8 w-8 text-[#8B949E]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {method.type === 'card' 
                        ? `${method.brand} ending in ${method.last4}`
                        : `PayPal (${method.email})`
                      }
                    </span>
                    {method.isDefault && (
                      <span className="px-2 py-0.5 bg-[#238636] text-white text-xs rounded">
                        Default
                      </span>
                    )}
                  </div>
                  {method.expiryDate && (
                    <p className="text-sm text-[#8B949E]">Expires {method.expiryDate}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!method.isDefault && (
                  <button
                    onClick={() => handleSetDefault(method.id)}
                    className="px-3 py-1 text-sm border border-[#30363D] rounded text-[#8B949E] hover:text-white hover:bg-[#30363D]/50"
                  >
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => handleRemoveMethod(method.id)}
                  className="p-1.5 text-[#8B949E] hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {paymentMethods.length === 0 && (
          <div className="text-center py-8 text-[#8B949E]">
            <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No payment methods added yet</p>
          </div>
        )}
      </div>

      {/* Billing History */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Billing History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#30363D]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#8B949E]">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#8B949E]">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#8B949E]">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#8B949E]">Invoice</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-[#8B949E]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((invoice) => (
                <tr key={invoice.id} className="border-b border-[#30363D]/50">
                  <td className="py-3 px-4 text-sm">
                    {new Date(invoice.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm">${invoice.amount}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className="px-2 py-0.5 bg-[#238636]/20 text-[#238636] text-xs rounded">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-[#8B949E]">{invoice.invoice}</td>
                  <td className="py-3 px-4 text-sm text-right">
                    <button className="text-blue-500 hover:text-blue-400">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-transparent border border-[#30363D] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Payment Method</h3>
            
            <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-200">
                    Payment processing is not implemented in this demo. 
                    In production, this would integrate with Stripe or similar payment provider.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAddPayment(false)}
                className="px-4 py-2 border border-[#30363D] rounded-md text-[#8B949E] hover:text-white hover:bg-[#30363D]/50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowAddPayment(false);
                  addToast({
                    type: 'info',
                    title: 'Demo Mode',
                    message: 'Payment method would be added in production.'
                  });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Payment Method
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}