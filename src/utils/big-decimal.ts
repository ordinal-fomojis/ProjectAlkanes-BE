import bd from 'js-big-decimal'

// Workaround because bigDecimal is CJS, so doesn't work well with out ESM project
export const bigDecimal = typeof bd === 'function' ? bd : bd.default
