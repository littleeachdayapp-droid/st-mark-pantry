/* ============================================
   St. Mark Legacy Food Pantry — Volunteer Signup
   Date generation, toggle cards, form validation, API submission
   ============================================ */

(function () {
  'use strict';

  // ---- Config ----
  var API_BASE = 'https://st-mark-pantry.vercel.app';
  var WEEKS_AHEAD = 5;
  var PANTRY_DAYS = [1, 5, 6]; // Mon=1, Fri=5, Sat=6

  var DAY_NAMES = {
    1: 'Monday',
    5: 'Friday',
    6: 'Saturday'
  };

  var DAY_TIMES = {
    1: '5:00 PM – 7:00 PM',
    5: '10:00 AM – 12:00 PM',
    6: 'TJ pickup 8:30 AM, unloading 9:00 AM'
  };

  // ---- State ----
  var selectedDates = {};

  // ---- Generate upcoming pantry dates ----
  function generateDates() {
    var dates = [];
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from tomorrow
    var cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1);

    var endDate = new Date(today);
    endDate.setDate(endDate.getDate() + WEEKS_AHEAD * 7);

    while (cursor <= endDate) {
      var dow = cursor.getDay();
      if (PANTRY_DAYS.indexOf(dow) !== -1) {
        dates.push({
          date: formatISO(cursor),
          dayOfWeek: DAY_NAMES[dow],
          dayNum: dow,
          display: formatDisplay(cursor),
          time: DAY_TIMES[dow]
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  function formatISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function formatDisplay(d) {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatDisplayLong(d) {
    var parts = d.split('-');
    var date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // ---- Render date cards ----
  function renderDateGrid() {
    var grid = document.getElementById('date-grid');
    var dates = generateDates();

    dates.forEach(function (d) {
      var card = document.createElement('div');
      card.className = 'date-card';
      card.setAttribute('data-date', d.date);
      card.setAttribute('data-day', d.dayOfWeek);

      card.innerHTML =
        '<div class="card-day">' + d.dayOfWeek + '</div>' +
        '<div class="card-date">' + d.display + '</div>' +
        '<div class="card-time">' + d.time + '</div>';

      card.addEventListener('click', function () {
        if (selectedDates[d.date]) {
          delete selectedDates[d.date];
          card.classList.remove('selected');
        } else {
          selectedDates[d.date] = d;
          card.classList.add('selected');
        }
        clearError('dates');
      });

      grid.appendChild(card);
    });
  }

  // ---- Validation ----
  function validateForm() {
    var valid = true;

    var firstName = document.getElementById('firstName').value.trim();
    var lastName = document.getElementById('lastName').value.trim();
    var email = document.getElementById('email').value.trim();

    clearAllErrors();

    if (!firstName) {
      showError('firstName', 'First name is required');
      valid = false;
    }

    if (!lastName) {
      showError('lastName', 'Last name is required');
      valid = false;
    }

    if (!email) {
      showError('email', 'Email is required');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('email', 'Enter a valid email address');
      valid = false;
    }

    var dateCount = Object.keys(selectedDates).length;
    if (dateCount === 0) {
      showError('dates', 'Select at least one date');
      valid = false;
    } else if (dateCount > 20) {
      showError('dates', 'Maximum 20 dates per submission');
      valid = false;
    }

    return valid;
  }

  function showError(field, msg) {
    var el = document.getElementById(field + '-error');
    if (el) el.textContent = msg;
  }

  function clearError(field) {
    var el = document.getElementById(field + '-error');
    if (el) el.textContent = '';
  }

  function clearAllErrors() {
    var errors = document.querySelectorAll('.field-error');
    for (var i = 0; i < errors.length; i++) {
      errors[i].textContent = '';
    }
  }

  // ---- Submit ----
  function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) return;

    // Honeypot check
    var hp = document.getElementById('website');
    if (hp && hp.value) return;

    var btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Signing up...';

    var dates = Object.keys(selectedDates).sort().map(function (iso) {
      return {
        date: iso,
        dayOfWeek: selectedDates[iso].dayOfWeek
      };
    });

    var payload = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim() || undefined,
      role: document.getElementById('role').value || undefined,
      dates: dates
    };

    fetch(API_BASE + '/api/public/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.ok) {
          showSuccess(dates);
        } else {
          alert(data.error || 'Something went wrong. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Sign Up';
        }
      })
      .catch(function () {
        alert('Network error. Please check your connection and try again.');
        btn.disabled = false;
        btn.textContent = 'Sign Up';
      });
  }

  function showSuccess(dates) {
    document.getElementById('signup-form-wrapper').style.display = 'none';

    var banner = document.getElementById('success-banner');
    banner.style.display = 'block';

    var list = document.getElementById('success-dates');
    list.innerHTML = '';
    dates.forEach(function (d) {
      var li = document.createElement('li');
      li.textContent = formatDisplayLong(d.date);
      list.appendChild(li);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    renderDateGrid();
    document.getElementById('signup-form').addEventListener('submit', handleSubmit);
  });
})();
