// auth.js

// 1. Fetch user data from our backend
fetch('/user')
    .then(response => response.json())
    .then(user => {
        const authSection = document.getElementById('auth-section');

        if (user) {
            // User IS logged in
            // Replace the login button with their Avatar and Name
            authSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <a href="profile.html" style="text-decoration: none; color: white; display: flex; align-items: center; gap: 10px;">
                        <img src="${user.photos[2].value}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #ff9100;">
                        <span>${user.displayName}</span>
                    </a>
                    <a href="/logout" style="color: #aaa; font-size: 12px; margin-left: 10px; text-decoration: none;">(Logout)</a>
                </div>
            `;
            
            // If we are on the Profile Page, fill in the details!
            if (window.location.pathname.includes('profile.html')) {
                loadProfilePage(user);
            }

        } else {
            // User is NOT logged in. Ensure the login button is there.
            // (HTML already has it by default, so we do nothing or reset it)
        }
    })
    .catch(err => console.log("Not logged in"));

function loadProfilePage(user) {
    // This targets the specific elements in profile.html
    const profileImg = document.querySelector('.container img');
    const profileName = document.querySelector('.container h1');
    const profileId = document.querySelector('.container p');

    if (profileImg) profileImg.src = user.photos[2].value; // Large avatar
    if (profileName) profileName.textContent = user.displayName;
    if (profileId) profileId.textContent = `Steam ID: ${user.id}`;
}