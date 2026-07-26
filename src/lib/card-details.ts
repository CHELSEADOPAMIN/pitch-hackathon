export type CardDraft = {
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
};

export type PinchCardDetails = {
  sourceType: 'credit-card';
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
};

export type PreparedCard =
  { ok: true; value: PinchCardDetails } | { ok: false; message: string };

function passesLuhn(cardNumber: string) {
  let sum = 0;
  let doubleDigit = false;

  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    const character = cardNumber[index];
    if (character === undefined) return false;
    let digit = Number(character);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

export function prepareCardDetails(
  draft: CardDraft,
  now = new Date(),
): PreparedCard {
  const cardHolderName = draft.cardHolderName.trim();
  const cardNumber = draft.cardNumber.replace(/\D/g, '');
  const expiryMonth = Number.parseInt(draft.expiryMonth, 10);
  const expiryYear = Number.parseInt(draft.expiryYear, 10);
  const cvc = draft.cvc.replace(/\D/g, '');

  if (!cardHolderName || !cardNumber || !expiryMonth || !expiryYear || !cvc) {
    return { ok: false, message: 'Complete every card field.' };
  }
  if (
    cardNumber.length < 13 ||
    cardNumber.length > 19 ||
    !passesLuhn(cardNumber)
  ) {
    return { ok: false, message: 'Check the card number.' };
  }

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (
    expiryMonth < 1 ||
    expiryMonth > 12 ||
    draft.expiryYear.trim().length !== 4 ||
    expiryYear < currentYear ||
    (expiryYear === currentYear && expiryMonth < currentMonth)
  ) {
    return { ok: false, message: 'Check the expiry date.' };
  }
  if (cvc.length < 3 || cvc.length > 4) {
    return { ok: false, message: 'Check the security code.' };
  }

  return {
    ok: true,
    value: {
      sourceType: 'credit-card',
      cardHolderName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvc,
    },
  };
}

export function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}
