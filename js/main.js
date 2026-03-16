/**
 * RangeFinder — main.js
 * Handles: navbar scroll/mobile toggle, form validation, success state
 */

'use strict';

/* ============================================================
   1. NAVBAR — scroll effect + mobile hamburger
   ============================================================ */
(function initNavbar() {
  const navbar     = document.getElementById('navbar');
  const hamburger  = document.getElementById('hamburger');
  const mobileNav  = document.getElementById('mobile-nav');

  if (!navbar) return;

  // Scroll: add .scrolled class after 20px
  function onScroll() {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load

  // Hamburger toggle
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      const isOpen = mobileNav.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      // Prevent body scroll when menu is open
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close mobile nav when a link inside it is clicked
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (
        mobileNav.classList.contains('open') &&
        !navbar.contains(e.target)
      ) {
        mobileNav.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }
})();


/* ============================================================
   2. SMOOTH SCROLL for anchor links
   ============================================================ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        const navbarHeight = document.getElementById('navbar')
          ? document.getElementById('navbar').offsetHeight
          : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });
})();


/* ============================================================
   3. FORM HANDLING — validation + success state
   ============================================================ */
(function initForms() {

  // ── Utility: show inline error on a field ──
  function showError(field, message) {
    clearError(field);
    field.classList.add('form-input--error');
    field.style.borderColor = 'var(--color-error)';
    const err = document.createElement('p');
    err.className = 'form-hint form-hint--error';
    err.style.color = 'var(--color-error)';
    err.setAttribute('role', 'alert');
    err.textContent = message;
    field.parentNode.appendChild(err);
  }

  function clearError(field) {
    field.style.borderColor = '';
    const existing = field.parentNode.querySelector('.form-hint--error');
    if (existing) existing.remove();
  }

  // ── Utility: validate a single field ──
  function validateField(field) {
    const value = field.value.trim();

    if (field.hasAttribute('required') && !value) {
      showError(field, 'This field is required.');
      return false;
    }

    if (field.type === 'email' && value) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) {
        showError(field, 'Please enter a valid email address.');
        return false;
      }
    }

    if (field.type === 'url' && value) {
      try {
        new URL(value);
      } catch (_) {
        showError(field, 'Please enter a valid URL (include https://).');
        return false;
      }
    }

    if (field.type === 'date' && value) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(value);
      if (selected < today) {
        showError(field, 'Please select a future date.');
        return false;
      }
    }

    clearError(field);
    return true;
  }

  // ── Validate date range (start must be before end) ──
  function validateDateRange(startField, endField) {
    if (!startField || !endField) return true;
    const start = new Date(startField.value);
    const end   = new Date(endField.value);
    if (startField.value && endField.value && start >= end) {
      showError(endField, 'End date must be after start date.');
      return false;
    }
    clearError(endField);
    return true;
  }

  // ── Validate at least one checkbox in a group ──
  function validateCheckboxGroup(groupEl, groupName, errorContainer) {
    const checked = groupEl.querySelectorAll('input[type="checkbox"]:checked');
    const existing = errorContainer.querySelector('.check-group-error');
    if (existing) existing.remove();
    if (checked.length === 0) {
      const err = document.createElement('p');
      err.className = 'form-hint check-group-error';
      err.style.color = 'var(--color-error)';
      err.setAttribute('role', 'alert');
      err.textContent = 'Please select at least one option.';
      errorContainer.appendChild(err);
      return false;
    }
    return true;
  }

  // ── Validate radio group ──
  function validateRadioGroup(form, name) {
    const radios = form.querySelectorAll('input[type="radio"][name="' + name + '"]');
    const checked = form.querySelector('input[type="radio"][name="' + name + '"]:checked');
    if (!checked) {
      // Find the last radio's parent to append error
      const lastRadio = radios[radios.length - 1];
      const container = lastRadio ? lastRadio.closest('.check-group') : null;
      if (container) {
        const existing = container.querySelector('.radio-group-error');
        if (!existing) {
          const err = document.createElement('p');
          err.className = 'form-hint radio-group-error';
          err.style.color = 'var(--color-error)';
          err.setAttribute('role', 'alert');
          err.textContent = 'Please select an option.';
          container.appendChild(err);
        }
      }
      return false;
    }
    // Clear error if present
    const container = radios[0] ? radios[0].closest('.check-group') : null;
    if (container) {
      const existing = container.querySelector('.radio-group-error');
      if (existing) existing.remove();
    }
    return true;
  }

  // ── Full form validation ──
  function validateForm(form) {
    let valid = true;

    // Text / email / tel / url / date / select inputs
    form.querySelectorAll('.form-input[required], .form-select[required], .form-textarea[required]')
      .forEach(function (field) {
        if (!validateField(field)) valid = false;
      });

    // Date range check (request-range form)
    const dateStart = form.querySelector('#date-start');
    const dateEnd   = form.querySelector('#date-end');
    if (dateStart && dateEnd) {
      if (!validateDateRange(dateStart, dateEnd)) valid = false;
    }

    // Radio group: classification (request-range form)
    if (form.querySelector('input[name="classification"]')) {
      if (!validateRadioGroup(form, 'classification')) valid = false;
    }

    // Checkbox: domains (affiliate form) — at least one required
    const domainsGroup = form.querySelector('[aria-label="Supported UxS domains"]');
    if (domainsGroup) {
      if (!validateCheckboxGroup(domainsGroup, 'domains', domainsGroup.closest('.form-group'))) {
        valid = false;
      }
    }

    // Checkbox: capabilities (request-range form) — at least one required
    const capsGroup = form.querySelector('[aria-label="Required range capabilities"]');
    if (capsGroup) {
      if (!validateCheckboxGroup(capsGroup, 'capabilities', capsGroup.closest('.form-group'))) {
        valid = false;
      }
    }

    // Required checkboxes (terms, accuracy)
    form.querySelectorAll('input[type="checkbox"][required]').forEach(function (cb) {
      const existing = cb.parentNode.querySelector('.cb-error');
      if (existing) existing.remove();
      if (!cb.checked) {
        valid = false;
        const err = document.createElement('p');
        err.className = 'form-hint cb-error';
        err.style.color = 'var(--color-error)';
        err.setAttribute('role', 'alert');
        err.textContent = 'You must check this box to continue.';
        cb.parentNode.appendChild(err);
      }
    });

    return valid;
  }

  // ── Live validation on blur ──
  function attachLiveValidation(form) {
    form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(function (field) {
      field.addEventListener('blur', function () {
        validateField(field);
      });
      field.addEventListener('input', function () {
        if (field.style.borderColor === 'var(--color-error)') {
          validateField(field);
        }
      });
    });
  }

  // ── Show success state ──
  function showSuccess(form) {
    const successEl = document.getElementById('form-success');
    if (successEl) {
      form.style.display = 'none';
      successEl.style.display = 'block';
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Simulate submit (no backend yet) ──
  function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submitBtn = form.querySelector('#submit-btn');

    // Run validation
    if (!validateForm(form)) {
      // Scroll to first error
      const firstError = form.querySelector('[role="alert"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Disable button and show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
    }

    // Simulate async submission (replace with real fetch() call later)
    setTimeout(function () {
      showSuccess(form);
    }, 1200);
  }

  // ── Attach to forms ──
  ['range-request-form', 'affiliate-form'].forEach(function (formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    attachLiveValidation(form);
    form.addEventListener('submit', handleSubmit);
  });

})();


/* ============================================================
   4. ACTIVE NAV LINK — highlight current page
   ============================================================ */
(function highlightActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__link').forEach(function (link) {
    const href = link.getAttribute('href') || '';
    if (href === path || href.startsWith(path + '#')) {
      link.classList.add('active');
    }
  });
})();


/* ============================================================
   5. HERO PARALLAX (subtle, desktop only)
   ============================================================ */
(function initParallax() {
  const heroBg = document.querySelector('.hero__bg');
  if (!heroBg) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function onScroll() {
    const scrollY = window.scrollY;
    heroBg.style.transform = 'translateY(' + (scrollY * 0.25) + 'px)';
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();
