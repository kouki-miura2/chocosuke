import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import './fonts.css'
import { createVuetify } from 'vuetify'
import { ja } from 'vuetify/locale'

// Light theme only (docs/spec.md "共通ルール > 画面"), colors from the screen design sample.
export const vuetify = createVuetify({
  locale: { locale: 'ja', messages: { ja } },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#2B5C8A',
          secondary: '#5B5F68',
          error: '#BA1A1A',
          background: '#FCFCFF',
          surface: '#FFFFFF',
          'surface-variant': '#E1E2E8',
          'primary-container': '#D3E4FF',
          'on-primary-container': '#001C38',
          sunday: '#C62828',
          saturday: '#1F5FBF',
        },
      },
    },
  },
  defaults: {
    VTextField: { variant: 'outlined' },
    VTextarea: { variant: 'outlined' },
    VSelect: { variant: 'outlined' },
    VCombobox: { variant: 'outlined' },
    VDateInput: { variant: 'outlined', prependIcon: '', prependInnerIcon: '$calendar' },
    VBtn: { rounded: 'pill' },
  },
})
