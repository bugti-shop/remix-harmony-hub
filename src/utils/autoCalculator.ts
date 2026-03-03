// Auto-calculator utility for detecting and solving math expressions in text
// Works completely offline - no external API calls

/**
 * Safely evaluates a mathematical expression
 * Supports: +, -, *, /, ^, parentheses, x (as multiplication), % (percentage)
 * 
 * Percentage handling:
 * - "50+10%" means 50 + (10% of 50) = 55
 * - "100-20%" means 100 - (20% of 100) = 80
 * - "50*10%" means 50 * 0.1 = 5
 * - "100/50%" means 100 / 0.5 = 200
 * 
 * Works completely offline
 */
export const safeEvaluate = (expression: string): number | null => {
  try {
    // Clean the expression - remove spaces and trailing equals
    let cleaned = expression.trim().replace(/\s+/g, '').replace(/=+$/, '');
    
    // Replace common multiplication symbols with *
    cleaned = cleaned.replace(/×/g, '*').replace(/x/gi, '*').replace(/÷/g, '/');
    
    // Validate: only allow numbers, operators, decimal points, parentheses, and %
    if (!/^[0-9+\-*/().^%]+$/.test(cleaned)) {
      return null;
    }
    
    // Prevent empty or single-number expressions (but allow % as operator)
    if (!/[+\-*/^%]/.test(cleaned)) {
      return null;
    }
    
    // Replace ^ with ** for exponentiation
    cleaned = cleaned.replace(/\^/g, '**');
    
    // Handle percentage calculations
    // Pattern: number followed by +/- and number with %
    // "50+10%" -> 50 + (50 * 10 / 100) = 55
    // "100-20%" -> 100 - (100 * 20 / 100) = 80
    cleaned = cleaned.replace(/(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)%/g, (match, base, op, percent) => {
      const baseNum = parseFloat(base);
      const percentNum = parseFloat(percent);
      const percentValue = (baseNum * percentNum) / 100;
      return `${baseNum}${op}${percentValue}`;
    });
    
    // Handle multiplication/division with percentage: "50*10%" -> 50 * 0.1, "100/50%" -> 100 / 0.5
    cleaned = cleaned.replace(/([*/])\s*(\d+(?:\.\d+)?)%/g, (match, op, percent) => {
      const percentNum = parseFloat(percent);
      return `${op}${percentNum / 100}`;
    });
    
    // Handle standalone percentage at end (e.g., after other operations)
    cleaned = cleaned.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
    
    // Prevent dangerous patterns (letters other than operators)
    if (/[a-zA-Z_$]/.test(cleaned)) {
      return null;
    }
    
    // Prevent division by zero patterns
    if (/\/0(?![0-9.])/.test(cleaned)) {
      return null;
    }
    
    // Use Function constructor to safely evaluate (no access to globals)
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${cleaned})`)();
    
    // Check if result is a valid number
    if (typeof result === 'number' && isFinite(result) && !isNaN(result)) {
      // Round to avoid floating point issues
      return Math.round(result * 1000000000) / 1000000000;
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Detects patterns like "3+4=" and returns the expression before =
 */
export const detectMathExpression = (text: string): { expression: string; position: number } | null => {
  // Match patterns like "3+4=", "10*5=", "(2+3)*4=", "56x45=", "50+10%=", etc.
  // The pattern should end with = and be preceded by a valid math expression
  // Include 'x' and '×' as multiplication symbols
  const regex = /([0-9+\-*/().^%×÷x\s]+)=$/i;
  const match = text.match(regex);
  
  if (match && match[1]) {
    const expression = match[1].trim();
    // Ensure there's at least one operator (including x for multiplication)
    if (/[+\-*/^%×÷x]/i.test(expression)) {
      return {
        expression,
        position: match.index || 0
      };
    }
  }
  
  return null;
};

/**
 * Process text and auto-complete calculations
 * Input: "3+4=" -> Output: "7"
 * Input: "56*45=" -> Output: "2520"
 * Input: "56x45=" -> Output: "2520"
 * Input: "50+10%=" -> Output: "55"
 * Input: "100-20%=" -> Output: "80"
 */
export const autoCalculate = (text: string): string | null => {
  const detected = detectMathExpression(text);
  
  if (!detected) return null;
  
  const result = safeEvaluate(detected.expression);
  
  if (result !== null) {
    // Format the result nicely
    const formattedResult = Number.isInteger(result) 
      ? result.toString() 
      : result.toFixed(Math.min(10, (result.toString().split('.')[1] || '').length));
    
    return formattedResult;
  }
  
  return null;
};

/**
 * Check if cursor is right after an = sign following a math expression
 */
export const shouldAutoCalculate = (text: string, cursorPosition: number): boolean => {
  const textBeforeCursor = text.substring(0, cursorPosition);
  return detectMathExpression(textBeforeCursor) !== null;
};
