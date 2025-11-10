import bcrypt from 'bcryptjs';

const WORD_LIST = [
  'casa', 'sol', 'mar', 'rio', 'luz', 'paz', 'vida', 'amor', 'feliz', 'azul',
  'verde', 'forte', 'rapido', 'novo', 'bom', 'grande', 'livre', 'simples', 'certo', 'doce',
  'amigo', 'cafe', 'praia', 'flor', 'estrela', 'vento', 'nuvem', 'terra', 'pedra', 'lago',
  'ponte', 'porta', 'janela', 'livro', 'musica', 'alegre', 'bonito', 'claro', 'suave', 'puro'
];

export function generateMemorablePassword(): string {
  const word1 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  const word2 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  const number = Math.floor(Math.random() * 900) + 100;
  
  const capitalizedWord1 = word1.charAt(0).toUpperCase() + word1.slice(1);
  const capitalizedWord2 = word2.charAt(0).toUpperCase() + word2.slice(1);
  
  return `${capitalizedWord1}${capitalizedWord2}${number}`;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
