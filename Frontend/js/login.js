const loginForm = document.querySelector("form");
const loginButton = loginForm.querySelector("button[type='submit']");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);

  const loginData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  // Loading state
  loginButton.disabled = true;
  loginButton.innerHTML = `
    <span class="inline-flex items-center gap-2">
      <span class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
      Signing in...
    </span>
  `;

  try {
    const response = await fetch("http://localhost:4000/users/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(loginData),
    });

    const data = await response.json();

    console.log(data);

    if (data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      loginButton.innerHTML = `
        <span class="inline-flex items-center gap-2">
          ✓ Login successful
        </span>
      `;

      setTimeout(() => {
        window.location.href = "./dashboard.html";
      }, 500);
    } else {
      alert(data.message);

      // Restore button
      loginButton.disabled = false;
      loginButton.innerHTML = "Sign in";
    }
  } catch (error) {
    console.error("Login error:", error);

    alert("Unable to connect to the server.");

    loginButton.disabled = false;
    loginButton.innerHTML = "Sign in";
  }
});