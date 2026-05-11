
function gcfindClearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll('.gc-field-error').forEach(el => el.remove());
  form.querySelectorAll('.gc-field-invalid').forEach(el => el.classList.remove('gc-field-invalid'));
}

function gcfindMarkRequiredField(input, message = 'This field is required.') {
  if (!input) return;
  input.classList.add('gc-field-invalid');
  const wrapper = input.parentElement || input;
  if (!wrapper.parentElement) return;
  if (wrapper.parentElement.querySelector(`[data-error-for="${input.id}"]`)) return;
  const p = document.createElement('p');
  p.className = 'gc-field-error';
  p.dataset.errorFor = input.id;
  p.textContent = message;
  wrapper.parentElement.appendChild(p);
}

function gcfindValidateRequiredFields(fields) {
  let valid = true;
  fields.forEach(({ input, message }) => {
    if (!input) return;
    if (!String(input.value || '').trim()) {
      valid = false;
      gcfindMarkRequiredField(input, message);
    }
  });
  return valid;
}

function gcfindAttachFieldErrorCleanup(scope = document) {
  scope.querySelectorAll('input, textarea, select').forEach(input => {
    if (input.dataset.gcFieldCleanupReady === 'true') return;
    input.dataset.gcFieldCleanupReady = 'true';
    input.addEventListener('input', () => {
      if (String(input.value || '').trim()) {
        input.classList.remove('gc-field-invalid');
        input.parentElement?.parentElement?.querySelector(`[data-error-for="${input.id}"]`)?.remove();
      }
    });
    input.addEventListener('change', () => {
      if (String(input.value || '').trim()) {
        input.classList.remove('gc-field-invalid');
        input.parentElement?.parentElement?.querySelector(`[data-error-for="${input.id}"]`)?.remove();
      }
    });
  });
}


function initUserLogin() {
  const form = $('#userLoginForm');
  if (!form) return;

  gcfindAttachFieldErrorCleanup(form);


  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    gcfindClearFieldErrors(form);

    const emailInput = $('#userEmail');
    const passwordInput = $('#userPassword');
    const email = (emailInput?.value || '').trim().toLowerCase();
    
      if (location.pathname.toLowerCase().includes("register") && !gcfindIsValidStudentEmail(email)) {
        gcfindShowStudentEmailError();
        return;
      }
const password = passwordInput?.value || '';
    const err = $('#loginError');
    if (err) err.textContent = '';

    const requiredOk = gcfindValidateRequiredFields([
      { input: emailInput, message: 'Email is required.' },
      { input: passwordInput, message: 'Password is required.' }
    ]);

    if (!requiredOk) {
      if (err) err.textContent = 'Please fill out the required fields.';
      showError('Please fill out the required fields.', { position: 'center' });
      return;
    }

    showLoading('Signing you in...');

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        if (err) err.textContent = error.message;
        showError(error.message || 'Something went wrong. Please try again.', { position: 'center', duration: 3200 });
        return;
      }

      const user = data?.user;
      if (!user) {
        showError('Unable to sign in. Please try again.', { position: 'center', duration: 3200 });
        return;
      }

      const profile = await Promise.race([
        fetchProfileById(user.id),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]);

      if (!profile) {
        if (err) err.textContent = 'Profile not found. Please contact the administrator.';
        showError('Profile not found. Please contact the administrator.', { position: 'center', duration: 3200 });
        await sb.auth.signOut();
        clearSession();
        return;
      }

      const role = profile.role || 'student';

      setRole(role === 'admin' || role === 'system_admin' ? 'admin' : 'user');
      setUser({
        id: user.id,
        name: profile.full_name || user.email,
        email: user.email,
        role,
        department: profile.department || 'General'
      });

      showSuccess('Login successful. Redirecting...', { position: 'center', duration: 900 });
      setTimeout(() => {
        if (role === 'system_admin') {
          window.location.href = 'system-admin.html';
        } else if (role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 850);
    } catch (error) {
      console.error('Login failed:', error);
      showError(error.message || 'Login failed. Please try again.', { position: 'center', duration: 3200 });
    } finally {
      hideLoading();
    }
  });
}


function initAdminLogin() {
  const form = $('#adminLoginForm');
  if (!form) return;

  gcfindAttachFieldErrorCleanup(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    gcfindClearFieldErrors(form);

    const emailInput = $('#adminEmail');
    const passwordInput = $('#adminPassword');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passwordInput?.value || '';
    const err = $('#adminLoginError');
    if (err) err.textContent = '';

    const requiredOk = gcfindValidateRequiredFields([
      { input: emailInput, message: 'Email is required.' },
      { input: passwordInput, message: 'Password is required.' }
    ]);

    if (!requiredOk) {
      if (err) err.textContent = 'Please fill out the required fields.';
      showError('Please fill out the required fields.', { position: 'center' });
      return;
    }

    showLoading('Opening admin dashboard...');

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        if (err) err.textContent = error.message;
        showError(error.message || 'Unable to sign in.', { position: 'center', duration: 3200 });
        return;
      }

      const user = data?.user;
      if (!user) {
        showError('Unable to sign in. Please try again.', { position: 'center', duration: 3200 });
        return;
      }

      const profile = await Promise.race([
        fetchProfileById(user.id),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]);

      if (!profile || !['admin', 'system_admin'].includes(profile.role)) {
        if (err) err.textContent = 'This account does not have admin access.';
        showError('This account does not have admin access.', { position: 'center', duration: 3200 });
        await sb.auth.signOut();
        clearSession();
        return;
      }

      setRole('admin');
      setUser({
        id: user.id,
        name: profile.full_name || user.email,
        email: user.email,
        role: profile.role,
        department: profile.department || 'Security Office'
      });

      showSuccess('Login successful. Redirecting...', { position: 'center', duration: 900 });
      setTimeout(() => {
        window.location.href = profile.role === 'system_admin' ? 'system-admin.html' : 'admin.html';
      }, 850);
    } catch (error) {
      console.error('Admin login failed:', error);
      showError(error.message || 'Admin login failed. Please try again.', { position: 'center', duration: 3200 });
    } finally {
      hideLoading();
    }
  });
}


function gcfindGetPasswordStrengthLevel(value = '') {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (!value) return 'empty';
  if (score <= 2 || value.length < 8) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

function gcfindUpdatePasswordStrength(input, meter) {
  if (!input || !meter) return;
  const label = meter.querySelector('.gc-password-strength-label');
  const level = gcfindGetPasswordStrengthLevel(input.value || '');
  meter.classList.remove('gc-password-strength-empty', 'gc-password-strength-weak', 'gc-password-strength-medium', 'gc-password-strength-strong');
  meter.classList.add(`gc-password-strength-${level}`);
  if (label) {
    label.textContent = level === 'empty' ? 'Enter a password' : level.charAt(0).toUpperCase() + level.slice(1);
  }
}

function gcfindInitRegisterPasswordStrength() {
  const passwordInput = document.getElementById('regPassword');
  const strengthMeter = document.getElementById('regPasswordStrength');
  if (!passwordInput || !strengthMeter) return;

  const update = () => gcfindUpdatePasswordStrength(passwordInput, strengthMeter);
  passwordInput.removeEventListener('input', update);
  passwordInput.addEventListener('input', update);
  passwordInput.addEventListener('keyup', update);
  passwordInput.addEventListener('change', update);
  update();
}

function initRegisterForm() {
  const form = $('#registerForm');
  if (!form) return;

  gcfindAttachFieldErrorCleanup(form);
  gcfindInitRegisterPasswordStrength();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    gcfindClearFieldErrors(form);

    const nameInput = $('#regName');
    const emailInput = $('#regEmail');
    const passwordInput = $('#regPassword');
    const confirmPasswordInput = $('#regConfirmPassword');

    const name = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = (passwordInput?.value || '').trim();
    const confirmPassword = (confirmPasswordInput?.value || '').trim();
    const role = ($('#regRole')?.value || 'student').trim();
    const department = ($('#regDepartment')?.value || 'General').trim();

    const requiredOk = gcfindValidateRequiredFields([
      { input: nameInput, message: 'Full name is required.' },
      { input: emailInput, message: 'Email is required.' },
      { input: passwordInput, message: 'Password is required.' },
      { input: confirmPasswordInput, message: 'Please confirm your password.' }
    ]);

    if (!requiredOk) {
      showError('Please complete all required fields.', { position: 'center' });
      return;
    }

    if (password !== confirmPassword) {
      gcfindMarkRequiredField(confirmPasswordInput, 'Passwords do not match.');
      showError('Passwords do not match.', { position: 'center' });
      return;
    }

    showLoading('Creating your account...');

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role,
          department
        }
      }
    });

    if (error) {
      hideLoading();
      showError(error.message, { position: 'center', duration: 3200 });
      return;
    }

    const authUser = data.user;
    if (!authUser) {
      hideLoading();
      showError('Unable to create account.', { position: 'center' });
      return;
    }

    // Wait briefly to allow the DB trigger to create the profile row.
    let profile = null;
    for (let i = 0; i < 5; i++) {
      profile = await fetchProfileById(authUser.id);
      if (profile) break;
      await new Promise(r => setTimeout(r, 300));
    }

    hideLoading();

    if (!profile) {
      showInfo('Account created successfully. Please check your Gordon College email to verify your account before signing in.', { position: 'center', duration: 4200 });
    } else {
      showSuccess('Account created successfully. Redirecting to login...', { position: 'center', duration: 1400 });
    }

    await sb.auth.signOut();
    clearSession();
    setTimeout(() => {
      window.location.href = 'login.html';
    }, profile ? 1300 : 2400);
  });
}


function initPasswordToggles(scope = document) {
  scope.querySelectorAll('[data-toggle-password]').forEach(btn => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });
}

async function initResetPasswordForm() {
  const form = document.getElementById('resetPasswordForm');
  if (!form) return;
  if (!requireSupabase()) return;

  initPasswordToggles(document);

  const statusBox = document.getElementById('resetLinkStatus');
  const setStatus = (message, kind = 'info') => {
    if (!statusBox) return;
    const styles = {
      info: 'mt-5 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-100',
      warn: 'mt-5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100',
      error: 'mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100',
      success: 'mt-5 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-100'
    };
    statusBox.className = styles[kind] || styles.info;
    statusBox.textContent = message;
  };

  function getUrlAuthParams() {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hashString = String(window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hashString);
    return {
      code: searchParams.get('code'),
      accessToken: hashParams.get('access_token'),
      refreshToken: hashParams.get('refresh_token'),
      type: searchParams.get('type') || hashParams.get('type')
    };
  }

  function cleanRecoveryUrl() {
    // Prevent accidental re-use of recovery tokens when the page refreshes.
    if (window.history?.replaceState) {
      window.history.replaceState({}, document.title, `${window.location.pathname}`);
    }
  }

  async function waitForSession(maxTries = 14, delayMs = 300) {
    for (let i = 0; i < maxTries; i++) {
      const { data } = await sb.auth.getSession();
      if (data?.session) return data.session;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
  }

  async function getRecoverySession() {
    const { code, accessToken, refreshToken } = getUrlAuthParams();

    // Supabase PKCE reset links arrive as /reset-password.html?code=...
    if (code && sb.auth.exchangeCodeForSession) {
      try {
        const { data, error } = await sb.auth.exchangeCodeForSession(code);
        if (!error && data?.session) {
          cleanRecoveryUrl();
          return data.session;
        }
      } catch (err) {
        console.error('exchangeCodeForSession failed:', err);
      }
    }

    // Supabase implicit reset links arrive as #access_token=...&refresh_token=...
    // Setting the session manually avoids the false “expired link” state.
    if (accessToken && refreshToken && sb.auth.setSession) {
      try {
        const { data, error } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (!error && data?.session) {
          cleanRecoveryUrl();
          return data.session;
        }
      } catch (err) {
        console.error('setSession from recovery hash failed:', err);
      }
    }

    // Fallback: Supabase may restore the session asynchronously after page load.
    return await waitForSession();
  }

  setStatus('Checking reset link...');
  const authParams = getUrlAuthParams();
  const hasRecoveryToken = Boolean(
    authParams.code ||
    authParams.accessToken ||
    authParams.refreshToken
  );

  const session = await getRecoverySession();

  if (!session) {
    setStatus(
      hasRecoveryToken
        ? 'This reset link could not be verified. It may be expired or already used. Please request a new password reset email.'
        : 'This reset link is missing recovery credentials. Please request a new password reset email.',
      'error'
    );
    form.classList.add('hidden');
    return;
  }

  setStatus('Reset link verified. Enter your new password below.', 'success');
  form.classList.remove('hidden');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const password = (document.getElementById('newPassword')?.value || '').trim();
    const confirmPassword = (document.getElementById('confirmNewPassword')?.value || '').trim();
    const err = document.getElementById('resetPasswordError');
    if (err) err.textContent = '';

    if (!password || !confirmPassword) {
      if (err) err.textContent = 'Please enter and confirm your new password.';
      return;
    }

    if (password.length < 6) {
      if (err) err.textContent = 'Password must be at least 6 characters.';
      return;
    }

    if (password !== confirmPassword) {
      if (err) err.textContent = 'Passwords do not match.';
      return;
    }

    showLoading('Updating password...');
    const { error } = await sb.auth.updateUser({ password });
    hideLoading();

    if (error) {
      if (err) err.textContent = error.message;
      return;
    }

    setStatus('Password updated successfully. Redirecting to login...', 'success');
    showSuccess('Password updated successfully. Please login again.', { position: 'center', duration: 1800 });
    await sb.auth.signOut();
    clearSession();
    setTimeout(() => { window.location.href = 'login.html'; }, 1600);
  });
}

/* ===================== REPORTS / ITEMS ===================== */



function initForgotPassword() {
  const openBtn = document.getElementById('forgotPasswordLink');
  const modal = document.getElementById('forgotPasswordModal');
  const closeBtn = document.getElementById('forgotPasswordClose');
  const cancelBtn = document.getElementById('forgotPasswordCancel');
  const form = document.getElementById('forgotPasswordForm');
  const emailInput = document.getElementById('forgotPasswordEmail');
  const message = document.getElementById('forgotPasswordMessage');
  if (!openBtn || !modal || !form) return;

  const openModal = () => {
    const loginEmail = document.getElementById('userEmail')?.value || '';
    if (emailInput && !emailInput.value) emailInput.value = loginEmail;
    if (message) {
      message.textContent = '';
      message.className = 'text-sm font-medium';
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => emailInput?.focus(), 50);
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireSupabase()) return;

    const email = (emailInput?.value || '').trim().toLowerCase();
    if (!email) return;

    const redirectTo = `${window.location.origin}/pages/reset-password.html`;

    try {
      showLoading('Sending password reset link...');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) throw error;

      if (message) {
        message.textContent = 'Password reset link sent. Please check your email. Redirecting to login...';
        message.className = 'text-sm font-semibold text-emerald-700';
      }

      showLoading('Reset link sent. Returning to login...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1200);
    } catch (err) {
      hideLoading();
      if (message) {
        message.textContent = err.message || 'Unable to send reset link.';
        message.className = 'text-sm font-semibold text-red-600';
      }
      showError(err.message || 'Unable to send reset link.', { position: 'center' });
    }
  });
}


// Safety fallback for the public Create Account page.
// Keeps the password meter working even if another boot step fails before initRegisterForm runs.
document.addEventListener('DOMContentLoaded', () => {
  try { gcfindInitRegisterPasswordStrength(); } catch (_) {}
});


// GCFind public registration role lock
// Public self-registration is student-only. Faculty/Staff accounts must be created by System Administrator.
document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.querySelector('#role, select[name="role"], #registerRole');
  if (roleSelect && location.pathname.toLowerCase().includes("register")) {
    roleSelect.value = "student";
    roleSelect.disabled = true;
    roleSelect.setAttribute("aria-disabled", "true");
  }
});


// GCFind register submit role safety guard
document.addEventListener("submit", (event) => {
  if (!location.pathname.toLowerCase().includes("register")) return;
  const form = event.target;
  if (!form || !form.querySelector) return;
  const roleField = form.querySelector('#role, select[name="role"], #registerRole');
  if (roleField) roleField.value = "student";
}, true);


// GCFind public registration hard role lock
// Public registration uses a hidden student role; visible role field is not interactive.
document.addEventListener("DOMContentLoaded", () => {
  if (!location.pathname.toLowerCase().includes("register")) return;
  const roleField = document.querySelector('#role, input[name="role"]');
  if (roleField) roleField.value = "student";
});
document.addEventListener("submit", (event) => {
  if (!location.pathname.toLowerCase().includes("register")) return;
  const form = event.target;
  if (!form || !form.querySelector) return;
  const roleField = form.querySelector('#role, input[name="role"]');
  if (roleField) roleField.value = "student";
}, true);




// GCFind final email warning placement fix: attach warning to email input wrapper.
(function () {
  function placeEmailWarningInsideWrapper() {
    if (!location.pathname.toLowerCase().includes("register")) return;

    const box = document.getElementById("regEmailCustomError");
    const input = document.querySelector("#regEmail, #email, input[name='email'], input[type='email']");
    if (!box || !input) return;

    const wrapper = input.closest(".relative") || input.parentElement;
    if (!wrapper) return;

    if (getComputedStyle(wrapper).position === "static") {
      wrapper.style.position = "relative";
    }

    if (box.parentElement !== wrapper) {
      wrapper.appendChild(box);
    }
  }

  document.addEventListener("DOMContentLoaded", placeEmailWarningInsideWrapper);
  document.addEventListener("input", placeEmailWarningInsideWrapper, true);
  document.addEventListener("click", placeEmailWarningInsideWrapper, true);
})();


// GCFind FINAL submit-only email validation for public registration
// The warning does NOT appear while typing. It appears only when Register Account is clicked/submitted with an invalid email.
(function () {
  const EMAIL_RE = /^\d{6,12}@gordoncollege\.edu\.ph$/;
  const MESSAGE = "Use your Gordon College domain email only. Example: 12346789@gordoncollege.edu.ph";

  function isRegisterPage() {
    return location.pathname.toLowerCase().includes("register");
  }

  function getEmailInput() {
    return document.querySelector("#regEmail, #email, input[name='email'], input[type='email']");
  }

  function getErrorBox() {
    return document.getElementById("regEmailCustomError");
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isValidStudentEmail(value) {
    return EMAIL_RE.test(normalizeEmail(value));
  }

  function clearEmailWarning() {
    const input = getEmailInput();
    const box = getErrorBox();

    if (input) {
      input.classList.remove("gc-input-error");
      input.removeAttribute("aria-invalid");
    }

    if (box) {
      box.innerHTML = "";
      box.classList.add("hidden");
    }
  }

  function showEmailWarning() {
    const input = getEmailInput();
    const box = getErrorBox();

    if (input) {
      input.classList.add("gc-input-error");
      input.setAttribute("aria-invalid", "true");
    }

    if (box) {
      box.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${MESSAGE}</span>`;
      box.classList.remove("hidden");
    }
  }

  function validateBeforeRegister(event) {
    if (!isRegisterPage()) return true;

    const input = getEmailInput();
    const email = normalizeEmail(input?.value);

    if (!isValidStudentEmail(email)) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      input?.focus?.();
      showEmailWarning();
      return false;
    }

    if (input) input.value = email;
    clearEmailWarning();
    return true;
  }

  window.gcfindIsValidStudentEmail = isValidStudentEmail;
  window.gcfindShowStudentEmailError = showEmailWarning;
  window.gcfindClearRegisterEmailError = clearEmailWarning;

  document.addEventListener("DOMContentLoaded", function () {
    if (isRegisterPage()) clearEmailWarning();
  });

  // While typing, only clear an existing warning. Never show it live.
  document.addEventListener("input", function (event) {
    if (!isRegisterPage()) return;
    const target = event.target.closest?.("#regEmail, #email, input[name='email'], input[type='email']");
    if (!target) return;
    clearEmailWarning();
  }, true);

  document.addEventListener("submit", function (event) {
    validateBeforeRegister(event);
  }, true);

  document.addEventListener("click", function (event) {
    if (!isRegisterPage()) return;
    const button = event.target.closest?.("button");
    if (!button) return;

    const text = String(button.textContent || "").toLowerCase();
    const id = String(button.id || "").toLowerCase();

    if (text.includes("register account") || id.includes("register")) {
      validateBeforeRegister(event);
    }
  }, true);
})();


// GCFind FINAL click-gated register email warning
// Any older live validation can call gcfindShowStudentEmailError,
// but this gate will only display the warning after the user attempts Register Account.
(function () {
  const EMAIL_RE = /^\d{6,12}@gordoncollege\.edu\.ph$/;
  const MESSAGE = "Use your Gordon College domain email only. Example: 12346789@gordoncollege.edu.ph";
  let registerAttempted = false;

  function isRegisterPage() {
    return location.pathname.toLowerCase().includes("register");
  }

  function getEmailInput() {
    return document.querySelector("#regEmail, #email, input[name='email'], input[type='email']");
  }

  function getBox() {
    return document.getElementById("regEmailCustomError");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function valid(value) {
    return EMAIL_RE.test(normalize(value));
  }

  function hideWarning() {
    const input = getEmailInput();
    const box = getBox();

    if (input) {
      input.classList.remove("gc-input-error");
      input.removeAttribute("aria-invalid");
    }

    if (box) {
      box.innerHTML = "";
      box.classList.add("hidden");
      box.style.display = "none";
    }
  }

  function showWarning() {
    if (!registerAttempted) {
      hideWarning();
      return;
    }

    const input = getEmailInput();
    const box = getBox();

    if (input) {
      input.classList.add("gc-input-error");
      input.setAttribute("aria-invalid", "true");
    }

    if (box) {
      box.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${MESSAGE}</span>`;
      box.classList.remove("hidden");
      box.style.display = "flex";
    }
  }

  function validateOnAttempt(event) {
    if (!isRegisterPage()) return true;

    registerAttempted = true;

    const input = getEmailInput();
    const email = normalize(input?.value);

    if (!valid(email)) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      input?.focus?.();
      showWarning();
      return false;
    }

    if (input) input.value = email;
    hideWarning();
    return true;
  }

  window.gcfindIsValidStudentEmail = valid;
  window.gcfindShowStudentEmailError = showWarning;
  window.gcfindClearRegisterEmailError = hideWarning;

  document.addEventListener("DOMContentLoaded", function () {
    if (!isRegisterPage()) return;
    registerAttempted = false;
    hideWarning();
  });

  // Typing must never show the warning. It resets the attempt state and hides it.
  document.addEventListener("input", function (event) {
    if (!isRegisterPage()) return;
    const target = event.target.closest?.("#regEmail, #email, input[name='email'], input[type='email']");
    if (!target) return;
    registerAttempted = false;
    hideWarning();
  }, true);

  document.addEventListener("submit", function (event) {
    validateOnAttempt(event);
  }, true);

  document.addEventListener("click", function (event) {
    if (!isRegisterPage()) return;
    const button = event.target.closest?.("button");
    if (!button) return;

    const text = String(button.textContent || "").toLowerCase();
    const id = String(button.id || "").toLowerCase();

    if (text.includes("register account") || id.includes("register")) {
      validateOnAttempt(event);
    }
  }, true);

  // Safety: if an older live listener shows it during typing, immediately hide it unless register was attempted.
  document.addEventListener("keyup", function () {
    if (!isRegisterPage()) return;
    if (!registerAttempted) hideWarning();
  }, true);
})();
