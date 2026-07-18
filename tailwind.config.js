/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        kiaa: {
          // Blue accent — from Adobe Color "My Color Theme"
          50:    '#EDF2F6',  // palest blue tint
          100:   '#BED8E1',  // light blue — direct from palette
          200:   '#AAC5D5',  // mid blue
          300:   '#84AAC1',  // bright blue
          400:   '#6595B2',  // primary accent — direct from palette
          500:   '#59839D',  // blue mid
          600:   '#496B80',  // deeper blue
          700:   '#385262',  // dark blue — sidebar start
          800:   '#263944',  // deep navy — sidebar end / brand headings
          aqua:  '#6595B2',  // legacy alias
        },
        surface: {
          50:  '#ECEAE4',  // neutral page bg
          100: '#D5D0C4',  // neutral border — direct from palette
          200: '#BEB7AC',  // mid
          300: '#A2998F',  // muted text
          400: '#877C73',  // secondary text — direct from palette
          500: '#7A746E',  // mid text
          600: '#736F6B',  // strong
          700: '#6C6B68',  // primary text — direct from palette
          800: '#464644',  // darker
          900: '#2B2B2A',  // deepest
        },
        sand: {
          50:  '#EBE6D2',  // palette — palest cream
          100: '#DBD3C6',  // palette — light warm gray
          200: '#DECCA6',  // palette — light tan
          300: '#D0C0A7',  // palette — medium tan
          400: '#B1A38E',  // deeper tan
          500: '#928675',  // darker tan
          600: '#726A5C',  // deepest tan
        }
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'xl':  '10px',
        '2xl': '14px',
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgba(108,107,104,0.07), 0 1px 2px -1px rgba(108,107,104,0.05)',
        'card-hover': '0 4px 14px 0 rgba(108,107,104,0.11)',
        'modal':      '0 20px 60px -10px rgba(108,107,104,0.22)',
      },
      letterSpacing: {
        widest: '0.14em',
      }
    }
  },
  plugins: []
}
