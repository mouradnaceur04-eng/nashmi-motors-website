// Entry file for Speed Insights bundle
import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize Speed Insights when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectSpeedInsights({ debug: false });
  });
} else {
  injectSpeedInsights({ debug: false });
}
