export function clearFormErrors(formElement) {
    const inputs = formElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'input-error');
        input.removeAttribute('aria-invalid');
    });

    const errorContainers = formElement.querySelectorAll('[id^="error-"]');
    errorContainers.forEach(container => {
        container.textContent = '';
    });
}

export function displayFormErrors(formElement, errorsObj) {
    clearFormErrors(formElement);

    if (!errorsObj) return;

    // Recorre el objeto de errores devuelto por StoreAnimalRequest
    Object.keys(errorsObj).forEach(fieldName => {
        const messages = errorsObj[fieldName];
        const messageText = Array.isArray(messages) ? messages.join(', ') : messages;

        // Busca el input por su atributo name o id
        const inputElement = formElement.querySelector(`[name="${fieldName}"]`) || 
                             formElement.querySelector(`#${fieldName}`);

        if (inputElement) {
            inputElement.classList.add('is-invalid', 'input-error');
            inputElement.setAttribute('aria-invalid', 'true'); // Criterio técnico estricto de accesibilidad
        }

        // Inyecta el mensaje exactamente en el contenedor de ayuda (#error-numero_arete, etc.)
        const errorContainer = formElement.querySelector(`#error-${fieldName}`);
        if (errorContainer) {
            errorContainer.textContent = messageText;
        }
    });
}