// REPLACE THIS URL WITH YOUR RENDER BACKEND URL
const API_URL = 'https://classic-rust-api.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
    // Update Login Button Links automatically
    const loginBtn = document.querySelector('.steam-login');
    if (loginBtn) {
        loginBtn.href = `${API_URL}/auth/steam`;
    }

    // Check Login Status
    fetch(`${API_URL}/user`, {
        credentials: 'include' // IMPORTANT: Sends the session cookie to Render
    })
    .then(response => response.json())
    .then(user => {
        const authSection = document.getElementById('auth-section');

        if (user) {
            // User IS logged in
            authSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <a href="profile.html" style="text-decoration: none; color: white; display: flex; align-items: center; gap: 10px;">
                        <img src="${user.photos[2].value}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #ff9100;">
                        <span>${user.displayName}</span>
                    </a>
                    <a href="${API_URL}/logout" style="color: #aaa; font-size: 12px; margin-left: 10px; text-decoration: none;">(Logout)</a>
                </div>
            `;
            
            // Check if we are on Profile Page to update specific elements
            if (document.getElementById('profile-name')) {
                document.getElementById('profile-avatar').src = user.photos[2].value;
                document.getElementById('profile-name').innerText = user.displayName;
                document.getElementById('profile-steamid').innerText = `Steam ID: ${user.id}`;
            }
        }
    })
    .catch(err => console.log("Not logged in"));
});