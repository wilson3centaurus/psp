/**
 * PSP - Main JavaScript
 * Theme Toggle, Mobile Menu, Animations & Interactivity
 */

(function() {
  'use strict';

  // =============================================
  // Theme Toggle (Light/Dark Mode like GitHub)
  // =============================================
  const THEME_KEY = 'psp-theme';
  
  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function setStoredTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  function getPreferredTheme() {
    const stored = getStoredTheme();
    if (stored) return stored;
    // Default to dark theme
    return 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setStoredTheme(theme);
    
    // Update all theme toggle buttons
    document.querySelectorAll('.theme-toggle, .theme-toggle-login').forEach(btn => {
      const sunIcon = btn.querySelector('.fa-sun');
      const moonIcon = btn.querySelector('.fa-moon');
      if (sunIcon && moonIcon) {
        sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
        moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
      }
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // Initialize theme on page load
  setTheme(getPreferredTheme());

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!getStoredTheme()) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Attach theme toggle handlers when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-toggle, .theme-toggle-login').forEach(btn => {
      btn.addEventListener('click', toggleTheme);
    });
  });

  // =============================================
  // Mobile Sidebar Toggle
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    function openSidebar() {
      sidebar?.classList.add('open');
      overlay?.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('active');
      document.body.style.overflow = '';
    }

    menuBtn?.addEventListener('click', openSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    // Close on window resize if desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) closeSidebar();
    });
  });

  // =============================================
  // Password Toggle (Show/Hide)
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const icon = btn.querySelector('i');
        if (icon) {
          icon.classList.toggle('fa-eye', !isPassword);
          icon.classList.toggle('fa-eye-slash', isPassword);
        }
      });
    });
  });

  // =============================================
  // Auto-dismiss Alerts
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.alert').forEach(alert => {
      setTimeout(() => {
        alert.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => alert.remove(), 300);
      }, 5000);
    });
  });

  // Add fadeOut animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-10px); }
    }
  `;
  document.head.appendChild(style);

  // =============================================
  // Form Enhancements
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    // Add loading state to forms on submit
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', function(e) {
        const submitBtn = form.querySelector('button[type="submit"], .login-btn');
        if (submitBtn && !submitBtn.classList.contains('no-loading')) {
          const originalHTML = submitBtn.innerHTML;
          submitBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';
          submitBtn.disabled = true;
          
          // Re-enable after 10 seconds as fallback
          setTimeout(() => {
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;
          }, 10000);
        }
      });
    });

    // Confirm before delete
    document.querySelectorAll('form[onsubmit*="confirm"], .delete-form').forEach(form => {
      form.addEventListener('submit', function(e) {
        if (!confirm('Are you sure you want to delete this item?')) {
          e.preventDefault();
        }
      });
    });
  });

  // =============================================
  // Search Enhancement
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    const searchInputs = document.querySelectorAll('input[name="q"], .search-input input');
    
    searchInputs.forEach(input => {
      // Clear search on empty value (with debounce)
      let timeout;
      input.addEventListener('input', function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (this.value.trim() === '' && this.form) {
            // Don't auto-redirect, let user decide
          }
        }, 500);
      });

      // Add keyboard shortcut (Cmd/Ctrl + K)
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          input.focus();
        }
      });
    });
  });

  // =============================================
  // Table Row Animations
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = `${index * 0.05}s`;
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('tbody tr').forEach(row => {
      row.style.opacity = '0';
      observer.observe(row);
    });
  });

  // Add table row animation styles
  const tableStyles = document.createElement('style');
  tableStyles.textContent = `
    tbody tr.fade-in {
      animation: fadeInUp 0.4s ease-out forwards;
    }
  `;
  document.head.appendChild(tableStyles);

  // =============================================
  // Stat Card Ripple Effect
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          background: rgba(var(--primary-rgb), 0.2);
          border-radius: 50%;
          transform: scale(0);
          animation: ripple 0.6s ease-out;
          pointer-events: none;
        `;
        
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
      });
    });
  });

  // Add ripple animation
  const rippleStyles = document.createElement('style');
  rippleStyles.textContent = `
    @keyframes ripple {
      to { transform: scale(4); opacity: 0; }
    }
  `;
  document.head.appendChild(rippleStyles);

  // =============================================
  // Tooltip System
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
      el.addEventListener('mouseenter', function() {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = this.dataset.tooltip;
        document.body.appendChild(tooltip);
        
        const rect = this.getBoundingClientRect();
        tooltip.style.cssText = `
          position: fixed;
          top: ${rect.top - tooltip.offsetHeight - 8}px;
          left: ${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px;
          background: var(--text-primary);
          color: var(--bg-primary);
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
          pointer-events: none;
        `;
        
        this._tooltip = tooltip;
      });
      
      el.addEventListener('mouseleave', function() {
        this._tooltip?.remove();
      });
    });
  });

  // =============================================
  // Active Nav Link Highlight
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (currentPath === href || currentPath.startsWith(href + '/'))) {
        // Remove active from all
        document.querySelectorAll('.nav-link.active').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  // =============================================
  // Smooth Scroll for Internal Links
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  // =============================================
  // Keyboard Navigation
  // =============================================
  document.addEventListener('keydown', (e) => {
    // Focus trap for modals
    if (e.key === 'Tab') {
      const modal = document.querySelector('.modal.active');
      if (modal) {
        const focusables = modal.querySelectorAll('button, input, select, textarea, a[href]');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // =============================================
  // File Input Enhancement
  // =============================================
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', function() {
        const fileName = this.files[0]?.name;
        const label = this.parentElement.querySelector('.file-name');
        if (label && fileName) {
          label.textContent = fileName;
        }
      });
    });
  });

  // =============================================
  // Print Styles Helper
  // =============================================
  window.printPage = function() {
    window.print();
  };

  // =============================================
  // Export to Window for external use
  // =============================================
  window.PSP = {
    toggleTheme,
    setTheme,
    getPreferredTheme
  };

})();
