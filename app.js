import { firebaseConfig } from './firebase-config.js';

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const entriesRef = database.ref('entries');

const form = document.getElementById('userForm');
const entriesContainer = document.getElementById('entries');
const loadingElement = document.getElementById('loading');

const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 18
}).addTo(map);

form.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const address = document.getElementById('address').value.trim();
  
  if (name && address) {
    entriesRef.push({
      name: name,
      address: address,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => form.reset());
  }
});

entriesRef.on('value', snapshot => {
  loadingElement.style.display = 'none';
  entriesContainer.innerHTML = '';
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });

  const entries = snapshot.val();
  if (entries) {
    Object.entries(entries)
      .sort(([, a], [, b]) => b.timestamp - a.timestamp)
      .forEach(([key, entry]) => {
        const entryEl = document.createElement('div');
        entryEl.className = 'entry';
        entryEl.innerHTML = `
          <div class="entry-name">${escapeHtml(entry.name)}</div>
          <div class="entry-address">${escapeHtml(entry.address)}</div>
          <div class="entry-time">${new Date(entry.timestamp).toLocaleString()}</div>
          <button class="delete-btn" onclick="deleteEntry('${key}')">Delete</button>
        `;
        entriesContainer.appendChild(entryEl);

        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(entry.address)}&format=json&limit=1`)
          .then(response => response.json())
          .then(data => {
            if (data[0]) {
              const marker = L.marker([data[0].lat, data[0].lon]).addTo(map);
              marker.bindPopup(`${escapeHtml(entry.name)}<br>${escapeHtml(entry.address)}`);
              map.setView([data[0].lat, data[0].lon], 4);
            }
          })
          .catch(() => console.log(`Could not geocode: ${entry.address}`));
      });
  } else {
    entriesContainer.innerHTML = '<div class="entry">No entries yet.</div>';
  }
});

window.deleteEntry = key => {
  database.ref('entries/' + key).remove();
};

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
