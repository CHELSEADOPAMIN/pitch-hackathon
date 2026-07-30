import { Platform } from 'react-native';

import PinchGlasses from '../../modules/pinch-glasses';

type DiagnosticValue = string | number | boolean | null | undefined;

export function logDiagnosticEvent(
  event: string,
  fields: Record<string, DiagnosticValue> = {},
) {
  const message = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...fields,
  });

  console.info(`[PinchTrace] ${message}`);
  if (Platform.OS === 'android') {
    PinchGlasses.logTrace(message);
  }
}
