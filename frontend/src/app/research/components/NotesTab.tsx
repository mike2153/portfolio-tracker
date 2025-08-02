import React from 'react';

interface NotesTabProps {
  isLoading: boolean;
}

const NotesTab: React.FC<NotesTabProps> = ({ isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">Notes</h3>
      <p>Notes functionality coming soon.</p>
    </div>
  );
};

export default NotesTab;
