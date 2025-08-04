'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Save } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [formData, setFormData] = useState({
    displayName: '',
    email: user?.email || '',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Implement profile update API call
    addToast({
      type: 'success',
      title: 'Profile Updated',
      message: 'Your profile settings have been saved.'
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-[#8B949E] mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            placeholder="Enter your display name"
            className="w-full px-3 py-2 bg-transparent border border-[#30363D] rounded-md text-white placeholder-[#8B949E] focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#8B949E] mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            disabled
            className="w-full px-3 py-2 bg-transparent border border-[#30363D] rounded-md text-[#8B949E] cursor-not-allowed"
          />
          <p className="text-xs text-[#8B949E] mt-1">
            Email address cannot be changed
          </p>
        </div>

        {/* Timezone */}
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-[#8B949E] mb-2">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            value={formData.timezone}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-transparent border border-[#30363D] rounded-md text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
          </select>
        </div>

        {/* Date Format */}
        <div>
          <label htmlFor="dateFormat" className="block text-sm font-medium text-[#8B949E] mb-2">
            Date Format
          </label>
          <select
            id="dateFormat"
            name="dateFormat"
            value={formData.dateFormat}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-transparent border border-[#30363D] rounded-md text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        {/* Currency */}
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-[#8B949E] mb-2">
            Preferred Currency
          </label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-transparent border border-[#30363D] rounded-md text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}