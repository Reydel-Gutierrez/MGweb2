document.querySelectorAll('.calc-btn').forEach(button => {
    button.addEventListener('click', () => {
      const screen = document.getElementById('calculator-screen');
      screen.value += button.value;
    });
  });
  
  document.querySelectorAll('.operator').forEach(button => {
    button.addEventListener('click', () => {
      const screen = document.getElementById('calculator-screen');
      const lastChar = screen.value.slice(-1);
  
      // Check if the last character is an operator, if so, replace it
      if (["+", "-", "*", "/"].includes(lastChar)) {
        screen.value = screen.value.slice(0, -1) + button.value;
      } else if (screen.value.length > 0) { // Prevent adding operator as first character
        screen.value += button.value;
      }
    });
  });
  
  document.getElementById('calc-clear').addEventListener('click', () => {
    document.getElementById('calculator-screen').value = '';
  });
  
  document.getElementById('calc-equals').addEventListener('click', () => {
    const screen = document.getElementById('calculator-screen');
    try {
      // Use Function constructor to evaluate the expression safely
      screen.value = new Function('return ' + screen.value)();
    } catch (error) {
      screen.value = 'Error';
    }
  });
  