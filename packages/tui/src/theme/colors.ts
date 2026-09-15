export const colors = {
  border:   'cyan',         // box borders — btop uses #55b5db (cyan)
  title:    'cyanBright',   // text embedded in border titles
  primary:  'cyanBright',   // active selection / primary accent
  secondary:'yellow',       // ticker labels, minor labels
  up:       'greenBright',  // price above prev-day close
  down:     'red',          // price below prev-day close
  neutral:  'white',        // price unchanged
  muted:    'gray',         // dimmed / help text
  gold:     'yellow',       // gold values
  success:  'green',        // bids (buy side)
  danger:   'red',          // asks (sell side)
} as const;
