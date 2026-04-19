import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#090909', // Deep dark background
          surface: '#181818',    // Sidebar surface
          'surface-variant': '#262626',
          'surface-light': '#323232',
          primary: '#0091ff',    // Zalo Blue
          secondary: '#72808e',
          accent: '#0091ff',
          error: '#ff5252',
          warning: '#ffb74d',
          success: '#4caf50',
          info: '#0091ff',
          'on-background': '#ffffff',
          'on-surface': '#ffffff',
          'on-primary': '#ffffff',
        },
      },
      light: {
        dark: false,
        colors: {
          background: '#f4f5f7',
          surface: '#ffffff',
          'surface-variant': '#eef0f2',
          primary: '#0068ff',
          secondary: '#72808e',
          accent: '#0068ff',
          error: '#d32f2f',
          warning: '#f57f17',
          success: '#2e7d32',
          info: '#0277bd',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat', rounded: 'sm' },
    VTextField: { variant: 'solo', density: 'compact', rounded: 'sm', flat: true },
    VSelect: { variant: 'solo', density: 'compact', rounded: 'sm', flat: true },
    VAutocomplete: { variant: 'solo', density: 'compact', rounded: 'sm', flat: true },
    VTextarea: { variant: 'solo', density: 'compact', rounded: 'sm', flat: true },
    VCard: { rounded: 'sm', variant: 'flat' },
    VChip: { rounded: 'sm', size: 'small' },
    VDialog: { maxWidth: 600 },
  },
});
