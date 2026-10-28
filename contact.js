// BEGIN ENQUIRY RULES (kept identical in contact.js and Code.gs)
var EnquiryRules = (function () {
  var limits = {
    "Contact name": 120, "Learner": 5, "Age or school year": 40,
    "Support requested": 1000, "Desired lesson rate": 60, "Preferred format": 9, "Town or postcode area": 80,
    "Reply method": 8, "email": 254, "phone": 40, "website": 200,
    "loaded_at": 13, "Campaign source": 120, "Traffic source": 120,
    "Traffic medium": 120, "Campaign name": 120
  };
  function clean(value) {
    return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  }
  function validate(input, now) {
    var data = {}, errors = {};
    Object.keys(input).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(limits, key)) {
        errors.form = "Please use only the enquiry fields provided.";
      } else if (typeof input[key] !== "string" || input[key].length > limits[key]) {
        errors[key] = "Please keep this field within " + limits[key] + " characters.";
      } else {
        data[key] = clean(input[key]);
      }
    });
    function required(key, message) { if (!data[key]) errors[key] = message; }
    function choice(key, values, message, optional) {
      if ((!optional || data[key]) && values.indexOf(data[key]) === -1) errors[key] = message;
    }
    required("Contact name", "Enter your name.");
    choice("Learner", ["child", "adult"], "Choose who the tutoring is for.");
    if (data.Learner === "child") required("Age or school year", "Enter an age or school year.");
    required("Support requested", "Briefly tell us what you would like help with.");
    choice("Preferred format", ["online", "in-person", "not-sure"], "Choose online, in person or not sure.", true);
    if (data["Preferred format"] === "in-person") required("Town or postcode area", "Enter a town or postcode area.");
    choice("Reply method", ["email", "call", "text", "whatsapp"], "Choose how you would like us to reply.");
    if (data["Reply method"] === "email") required("email", "Enter your email address.");
    if (["call", "text", "whatsapp"].indexOf(data["Reply method"]) !== -1) required("phone", "Enter your UK phone number.");
    if (data.email && !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(data.email)) errors.email = "Enter a valid email address.";
    if (data.phone) {
      var phone = data.phone.replace(/[ ()-]/g, "");
      if (!/^(?:0[1-9]\d{9}|\+44[1-9]\d{9})$/.test(phone)) errors.phone = "Enter a UK number, starting with 0 or +44.";
    }
    if (!/^\d{13}$/.test(data.loaded_at || "") || Number(data.loaded_at) > now || now - Number(data.loaded_at) < 3000) {
      errors.loaded_at = "Please wait a few seconds, then send your enquiry.";
    }
    return { ok: Object.keys(errors).length === 0, data: data, errors: errors };
  }
  return { validate: validate, clean: clean, limits: limits };
})();
// END ENQUIRY RULES

(function () {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = EnquiryRules;
    return;
  }
  const form = document.getElementById("enquiry-form");
  if (!form) return;
  const formFields = document.getElementById("enquiry-fields");
  const submitButton = document.getElementById("submit-button");
  const formMessage = document.getElementById("form-message");
  const formEndpoint = form.dataset.formEndpoint.trim();
  const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const params = new URLSearchParams(window.location.search);
  const requestedService = params.get("service");
  const campaignSource = document.getElementById("campaign-source");
  if (["children", "english-work", "ielts", "qualifications", "languages", "maths", "in-person", "not-sure"].includes(requestedService)) {
    campaignSource.value = requestedService;
  }
  if (params.get("offer") === "launch") campaignSource.value = "launch-offer";
  document.getElementById("loaded-at").value = String(Date.now());
  form.noValidate = true;
  // HTML starts disabled so no-JavaScript visitors use the alternatives below.
  formFields.disabled = false;

  const controls = {
    "Contact name": "contact-name", "Learner": "learner-child", "Age or school year": "age-year",
    "Support requested": "support-needed", "Desired lesson rate": "desired-lesson-rate", "Preferred format": "format-online",
    "Town or postcode area": "location", "Reply method": "reply-email", "email": "email", "phone": "phone"
  };
  function selected(name) {
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : "";
  }
  function clearErrors() {
    Object.keys(controls).forEach((key) => {
      const control = document.getElementById(controls[key]);
      document.getElementById(control.id + "-error").textContent = "";
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute("aria-invalid"));
    formMessage.classList.remove("is-visible");
    formMessage.replaceChildren();
  }
  function syncConditional() {
    const reply = selected("Reply method");
    const active = {
      "age-year": selected("Learner") === "child",
      "location": selected("Preferred format") === "in-person",
      "email": reply === "email",
      "phone": ["call", "text", "whatsapp"].includes(reply)
    };
    Object.keys(active).forEach((id) => {
      const control = document.getElementById(id);
      const slot = document.getElementById(id + "-field");
      slot.hidden = !active[id];
      slot.inert = !active[id];
      control.disabled = !active[id];
      control.required = active[id];
    });
  }
  form.addEventListener("change", () => { syncConditional(); clearErrors(); });
  syncConditional();

  function showMessage(message) {
    const email = document.createElement("a");
    email.href = "mailto:hello@toucanlearn.co.uk";
    email.textContent = "hello@toucanlearn.co.uk";
    const phone = document.createElement("a");
    phone.href = "tel:+447309639095";
    phone.textContent = "07309 639095";
    formMessage.replaceChildren(message + " You can email ", email, " or call ", phone, ".");
    formMessage.classList.add("is-visible");
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.getAttribute("aria-busy") === "true") return;
    clearErrors();
    syncConditional();
    const body = new URLSearchParams(new FormData(form));
    const result = EnquiryRules.validate(Object.fromEntries(body), Date.now());
    if (!result.ok) {
      showMessage("Please check your enquiry. " + Object.values(result.errors).join(" "));
      Object.keys(result.errors).forEach((key) => {
        const id = controls[key];
        if (!id) return;
        document.getElementById(id + "-error").textContent = result.errors[key];
        form.querySelectorAll('[name="' + key + '"]').forEach((control) => control.setAttribute("aria-invalid", "true"));
      });
      const first = Object.keys(controls).find((key) => result.errors[key]);
      (first ? document.getElementById(controls[first]) : formMessage).focus();
      return;
    }
    if (!endpointPattern.test(formEndpoint)) {
      showMessage("The enquiry form is being set up; no information has been sent.");
      formMessage.focus();
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    form.setAttribute("aria-busy", "true");
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(() => requestController.abort(), 20000);
    try {
      const response = await fetch(formEndpoint, {
        method: "POST", credentials: "omit", redirect: "follow", cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body, signal: requestController.signal
      });
      if (!response.ok || (await response.json()).ok !== true) throw new Error("Enquiry failed");
      window.location.assign("thank-you.html");
    } catch (error) {
      showMessage("The enquiry could not be sent. Please try again.");
      formMessage.focus();
    } finally {
      window.clearTimeout(requestTimeout);
      form.removeAttribute("aria-busy");
      submitButton.disabled = false;
      submitButton.textContent = "Send my enquiry";
    }
  });
})();
