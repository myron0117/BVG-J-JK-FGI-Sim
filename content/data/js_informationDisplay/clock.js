function updateClock() {
  const clockElement = document.querySelector('.information-display-clock');

  const now = new Date();

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  clockElement.textContent = `${hours}:${minutes}`;
}

updateClock();

setInterval(updateClock, 1000);