import { useState, useEffect } from 'react';
import { scanAPI } from '../services/api';

export const useScans = () => {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchScans = async () => {
    try {
      setLoading(true);
      const response = await scanAPI.getScans();
      setScans(response.data.scans || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch scans');
    } finally {
      setLoading(false);
    }
  };

  const createScan = async (scanData) => {
    try {
      const response = await scanAPI.createScan(scanData);
      await fetchScans(); // Refresh the list
      return { success: true, data: response.data };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'Failed to create scan' 
      };
    }
  };

  const getScan = async (id) => {
    try {
      const response = await scanAPI.getScan(id);
      return { success: true, data: response.data.scan };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.message || 'Failed to fetch scan' 
      };
    }
  };

  useEffect(() => {
    fetchScans();
  }, []);

  return {
    scans,
    loading,
    error,
    fetchScans,
    createScan,
    getScan,
    refetch: fetchScans
  };
};