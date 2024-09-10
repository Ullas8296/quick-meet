'use strict';

let duration = 15;
let seatCount = 1;
let floor = 1;

const CLIENT_ID = '1043931677993-j15eelb1golb8544ehi2meeru35q3fo4.apps.googleusercontent.com';
const REDIRECT_URI = window.location.origin;
const BACKEND_ENDPOINT = REDIRECT_URI;

async function openPage(pageName, elmnt) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName('tabcontent');
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = 'none';
  }
  tablinks = document.getElementsByClassName('tablink');
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].style.color = '';
  }
  document.getElementById(pageName).style.display = 'block';
  elmnt.style.color = '#1971c2';

  if (pageName === 'my_events') {
    await populateEvents();
  }
}

function populateTimeOptions() {
  const startTimeSelect = document.getElementById('startTime');

  function toMinutesSinceMidnight(hours, minutes) {
    return hours * 60 + minutes;
  }

  const now = new Date();
  let currentHours = now.getHours();
  let currentMinutes = Math.floor(now.getMinutes() / 15) * 15;

  if (currentMinutes === 60) {
    currentMinutes = 0;
    currentHours += 1;
  }

  const currentTimeInMinutes = toMinutesSinceMidnight(currentHours, currentMinutes);

  for (let i = 0; i < 24 * 4; i++) {
    const hours = Math.floor(i / 4);
    const minutes = (i % 4) * 15;
    const formattedTime = formatTime(hours, minutes);
    const optionTimeInMinutes = toMinutesSinceMidnight(hours, minutes);

    if (optionTimeInMinutes >= currentTimeInMinutes) {
      const timeOption = document.createElement('option');
      timeOption.value = formattedTime;
      timeOption.text = formattedTime;
      startTimeSelect.appendChild(timeOption);

      if (!timeOption.selected && optionTimeInMinutes === currentTimeInMinutes) {
        timeOption.selected = true;
      }
    }
  }
}

function decrementDuration() {
  if (duration > 15) {
    duration -= 15;
    document.getElementById('duration').textContent = duration + 'm';
  }
}

function incrementDuration() {
  duration += 15;
  document.getElementById('duration').textContent = duration + 'm';
}

function decrementSeatCount() {
  if (seatCount > 1) {
    seatCount -= 1;
    document.getElementById('seat_text').textContent = seatCount;
  }
}

function incrementSeatCount() {
  seatCount += 1;
  document.getElementById('seat_text').textContent = seatCount;
}

function decrementFloor() {
  if (floor > 1) {
    floor -= 1;
    document.getElementById('floor_text').textContent = floor;
  }
}

function incrementFloor() {
  if (floor < 3) {
    floor += 1;
  }
  document.getElementById('floor_text').textContent = floor;
}

async function makeRequest(path, method, body, params) {
  try {
    let url = `${BACKEND_ENDPOINT}${path}`;
    if (params) {
      const queryParams = new URLSearchParams(params).toString();
      url += `?${queryParams}`;
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body || undefined),
    });

    console.log(res);

    if (res.status === 429) {
      createMyEventsAlert(res.statusText, 'danger');
      return null;
    }

    if (res.status === 401) {
      await logout();
      return null;
    }

    if (res) {
      return await res.json();
    }

    return null;
  } catch (error) {
    console.error('Error:', error);
    // alert(error.message || 'Something went wrong while making the request');
    return null;
  }
}

function login() {
  console.log('login clicked');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile&access_type=offline`;
  window.location.href = authUrl;
}

async function logout() {
  console.log('Logging out');
  await makeRequest('/logout', 'POST');
  removeToken();
  window.location.reload();
}

async function bookRoom() {
  console.log('Booking room');

  const spinner = bookBtn.querySelector('.spinner-border');
  bookBtn.disabled = true;
  spinner.style.display = 'inline-block';

  const startTimeSelect = document.getElementById('startTime');
  const startTime = startTimeSelect.value;

  const date = new Date(Date.now()).toISOString().split('T')[0];
  const formattedStartTime = convertToRFC3339(date, startTime);

  console.log('formattedStartTime', formattedStartTime);

  const duration = document.getElementById('duration').textContent;
  const seats = document.getElementById('seat_text').textContent;
  const floor = document.getElementById('floor_text').textContent;

  const res = await makeRequest('/room', 'POST', {
    startTime: formattedStartTime,
    duration: parseInt(duration),
    seats: parseInt(seats),
    floor: parseInt(floor),
    timeZone: getTimeZoneString(),
  });

  if (res.error) {
    createErrorAlert(res.message);
    return;
  }

  createRoomAlert(res.room, convertToLocaleTime(res.start), convertToLocaleTime(res.end), res.summary, 'info');

  bookBtn.disabled = false;
  spinner.style.display = 'none';
}

function toggleVisibility(id) {
  const element = document.getElementById(id);
  if (element.style.display === 'none' || element.style.display === '') {
    element.style.display = 'block';
  } else {
    element.style.display = 'none';
  }
}

window.onload = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    try {
      const res = await makeRequest('/oauth2callback', 'POST', { code });
      console.log('Access Token:', res.accessToken);
      if (res?.accessToken) {
        window.localStorage.setItem('access_token', res.accessToken);
      }
      window.location.href = '/';
      return;
    } catch (error) {
      console.error('Error:', error);
      window.location.href = '/';
      return;
    }
  }

  const token = getToken();

  if (token) {
    const loginPage = document.getElementById('loginPage');
    loginPage.style.display = 'none';

    const homePage = document.getElementById('homePage');
    homePage.style.display = 'block';

    document.getElementById('defaultOpen').click();
    populateTimeOptions();
  } else {
    const loginPage = document.getElementById('loginPage');
    loginPage.style.display = 'block';

    const homePage = document.getElementById('homePage');
    homePage.style.display = 'none';
  }
};

const createRoomAlert = (room, start, end, summary, type) => {
  const alertPlaceholder = document.getElementById('liveAlertPlaceholder');
  alertPlaceholder.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = [
    `<div style="text-align: left;" class="alert alert-${type} custom-alert-text alert-dismissible" role="alert">`,
    `   <div><b>Summary: </b>${summary}</div>`,
    `   <div><b>Room: </b>${room}</div>`,
    `   <div><b>Start: </b>${start}</div>`,
    `   <div><b>End: </b>${end}</div>`,
    '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
    '</div>',
  ].join('');

  alertPlaceholder.append(wrapper);
};

const createErrorAlert = (message) => {
  const alertPlaceholder = document.getElementById('liveAlertPlaceholder');
  alertPlaceholder.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = [
    `<div style="text-align: left;" class="alert alert-danger custom-alert-text alert-dismissible" role="alert">`,
    `   <div>${message}</div>`,
    '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
    '</div>',
  ].join('');

  alertPlaceholder.append(wrapper);
};

const createMyEventsAlert = (text, type = 'info') => {
  const alertPlaceholder = document.getElementById('my_events_empty_alert');
  alertPlaceholder.innerHTML = '';

  if (!text) {
    alertPlaceholder.style.display = 'none';
    return;
  }

  alertPlaceholder.style.display = 'block';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = [
    `<div style="text-align: left;" class="alert alert-${type} custom-alert-text alert-dismissible" role="alert">`,
    `   <div><b>${text}</b></div>`,
    '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
    '</div>',
  ].join('');

  alertPlaceholder.append(wrapper);
};

const populateEvents = async () => {
  const eventsContainer = document.getElementById('events-container');
  eventsContainer.innerHTML = '';

  createMyEventsAlert(null);

  const myEventsLoading = document.getElementById('my_events_loading');
  myEventsLoading.style.display = 'block';

  const res = await makeRequest('/rooms', 'GET', null, {
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    timeZone: getTimeZoneString(),
  });

  myEventsLoading.style.display = 'none';

  if (!res?.length) {
    createMyEventsAlert('No events for the day...');
    return;
  }

  res?.forEach((event) => {
    const eventHtml = `
        <div id="event-block-${event.id}" class="container text-center mt-4" style="color: black;">
            <div class="row">
                <div class="col-11 p-0">
                    <div class="my_events_field" style="background-color: #a5d8ff;">
                        <span id="event_name" class="event_name">${event.title}</span>
                    </div>
                    <div class="container text-center mt-1">
                        <div class="row">
                            <div class="col-7 p-0" style="text-align: center;">
                                <div class="my_events_field" style="background-color: #ffec99; padding-right: 10px">
                                    <span id="event_time" class="event_name">${convertToLocaleTime(event.start)} - ${convertToLocaleTime(event.end)}</span>
                                </div>
                            </div>
                            <div class="col-5 p-0">
                                <div class="my_events_field" style="background-color: #a5d8ff;">
                                    <span id="event_room" class="event_name">${event.room}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-1 p-0">
                    <button id="event-${event.id}" onclick="removeEvent('${event.id}')" class="my_event_btn btn btn-danger"> 
                        <i class="bi bi-calendar-x-fill"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    eventsContainer.innerHTML += eventHtml;
  });
};

async function removeEvent(id) {
  const btn = document.getElementById(`event-${id}`);
  btn.disabled = true;

  const res = await makeRequest('/room', 'DELETE', { id });
  btn.disabled = false;

  if (res?.error) {
    alert(res.message);
    return;
  }

  const eventElement = document.getElementById(`event-block-${id}`);
  if (eventElement) {
    eventElement.remove();
  }
}

// -------------------------------- utility ----------------------------------------------
// Function to format time in 12-hour format with AM/PM
function formatTime(hours, minutes) {
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // If hour is 0, it should be 12
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return hours + ':' + minutes + ' ' + ampm;
}

// returns timeZone formatted as "Asia/Dhaka", etc
function getTimeZoneString() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone;
}

function removeToken() {
  window.localStorage.removeItem('access_token');
}

function getToken() {
  const token = window.localStorage.getItem('access_token');
  if (!token) return null;

  if (token === 'undefined' || token.trim() === '') {
    return null;
  }

  return token;
}

function getTimezoneOffset() {
  const offsetInMinutes = new Date().getTimezoneOffset();
  const sign = offsetInMinutes <= 0 ? '+' : '-';
  const offsetInHours = Math.floor(Math.abs(offsetInMinutes) / 60);
  const offsetInRemainingMinutes = Math.abs(offsetInMinutes) % 60;
  const formattedOffset = `${sign}${String(offsetInHours).padStart(2, '0')}:${String(offsetInRemainingMinutes).padStart(2, '0')}`;

  return formattedOffset;
}

function convertToRFC3339(dateString, timeString) {
  const timeZoneOffset = getTimezoneOffset();
  const date = new Date(`${dateString} ${timeString}`);

  const [offsetSign, offsetHours, offsetMinutes] = timeZoneOffset.match(/([+-])(\d{2}):(\d{2})/).slice(1);

  const offsetInMinutes = (parseInt(offsetHours) * 60 + parseInt(offsetMinutes)) * (offsetSign === '+' ? 1 : -1);
  date.setMinutes(date.getMinutes() + offsetInMinutes);

  const isoString = date.toISOString();
  const [isoDate, isoTime] = isoString.split('T');

  // Return the formatted date and time in RFC 3339 format
  return `${isoDate}T${isoTime.split('.')[0]}${timeZoneOffset}`;
}

function convertToLocaleTime(dateStr) {
  const date = new Date(dateStr);

  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  return date.toLocaleTimeString('en-US', options);
}
