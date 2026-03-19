// Format date to readable string
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Calculate scan duration
export const calculateDuration = (startDate, endDate) => {
  if (!endDate) return 'In progress...';
  
  const duration = Math.round((new Date(endDate) - new Date(startDate)) / 1000);
  
  if (duration < 60) return `${duration}s`;
  if (duration < 3600) return `${Math.round(duration / 60)}m`;
  return `${Math.round(duration / 3600)}h`;
};

// Validate URL format
export const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Get severity color
export const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-blue-500';
    default:
      return 'text-gray-500';
  }
};

// Truncate text
export const truncateText = (text, maxLength = 50) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};