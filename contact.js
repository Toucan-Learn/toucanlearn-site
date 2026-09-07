(function () {
  const form = document.getElementById("enquiry-form");
  const formFields = document.getElementById("enquiry-fields");
  const submitButton = document.getElementById("submit-button");
  const formMessage = document.getElementById("form-message");
  const serviceSelect = document.getElementById("service");
  const campaignSource = document.getElementById("campaign-source");
  const formEndpoint = form.dataset.formEndpoint.trim();
  const requestedService = new URLSearchParams(window.location.search).get("service");
  const allowedServices = ["children", "english-work", "languages", "maths", "in-person", "not-sure"];

  if (requestedService && allowedServices.includes(requestedService)) {
    serviceSelect.value = requestedService;
    campaignSource.value = requestedService;
  }

  if (formEndpoint) {
    formFields.disabled = false;
    formMessage.classList.remove("is-visible");
    formMessage.textContent = "The enquiry could not be sent. Please try again.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!formEndpoint) {
      formMessage.textContent =
        "Online enquiries are not open yet. This form is disabled, and no information has been sent.";
      formMessage.classList.add("is-visible");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    formMessage.classList.remove("is-visible");
    form.setAttribute("aria-busy", "true");

    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(() => requestController.abort(), 20000);

    try {
      const response = await fetch(formEndpoint, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        },
        body: new FormData(form),
        signal: requestController.signal
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      window.location.href = "thank-you.html";
    } catch (error) {
      formMessage.textContent = "The enquiry could not be sent. Please try again.";
      formMessage.classList.add("is-visible");
      submitButton.disabled = false;
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      submitButton.replaceChildren("Send enquiry ", arrow);
    } finally {
      window.clearTimeout(requestTimeout);
      form.removeAttribute("aria-busy");
    }
  });
})();
