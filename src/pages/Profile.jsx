import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Profile.css';

const DEFAULT_AVATAR = (
  <svg className="profile-avatar" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="48" cy="48" r="48" fill="#e5e7eb"/>
    <path d="M48 52c7.18 0 13-5.82 13-13s-5.82-13-13-13-13 5.82-13 13 5.82 13 13 13zm0 4c-8.84 0-26 4.42-26 13.25V76h52v-6.75C74 60.42 56.84 56 48 56z" fill="#9ca3af"/>
  </svg>
);

const Profile = () => {
  const [user, setUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
    if (token) {
      axios.get('/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => setUser(res.data.user))
        .catch(() => setError('Failed to load user info.'));
    }
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setSuccess('');
    setError('');
  };

  const refreshUserInfo = async () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
    if (token) {
      try {
        const res = await axios.get('/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        setUser(res.data.user);
        localStorage.setItem('auth_user', JSON.stringify(res.data.user));
      } catch {
        setError('Failed to refresh user info.');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
      const formData = new FormData();
      formData.append('image', selectedFile);
      await axios.post('/api/user/upload-profile-pic', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      await refreshUserInfo();
      setSuccess('Profile picture updated!');
      setSelectedFile(null);
    } catch (err) {
      setError('Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('session_token');
      await axios.delete('/api/user/delete-profile-pic', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await refreshUserInfo();
      setSuccess('Profile picture deleted.');
    } catch (err) {
      setError('Failed to delete image.');
    } finally {
      setUploading(false);
    }
  };

  if (!user) return <div className="profile-page">Loading...</div>;

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-pic-section">
          {user.picture ? (
            <img src={user.picture} alt="Profile" className="profile-avatar" />
          ) : DEFAULT_AVATAR}
        </div>
        <div className="profile-info">
          <h2>{user.name || user.firstName || user.email}</h2>
          <p>{user.email}</p>
        </div>
        <div className="profile-actions">
          <label className="custom-file-label">
            Choose Image
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {selectedFile && (
            <span className="file-chosen">{selectedFile.name}</span>
          )}
          <button onClick={handleUpload} disabled={uploading || !selectedFile}>Upload New Image</button>
          <button onClick={handleDelete} disabled={uploading || !user.picture}>Delete Image</button>
        </div>
        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}
      </div>
    </div>
  );
};

export default Profile;
