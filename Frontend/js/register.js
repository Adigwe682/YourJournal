
const registerForm = document.querySelector("form");

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(registerForm);

  const registerData = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  console.log(registerData);

  const response = await fetch("https://yourjournal.onrender.com/users/register", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(registerData),
  });

  const data = await response.json();

  console.log(data);

  if (data.success) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    window.location.href = "./dashboard.html";
  } else {
    alert(data.message);
  }
});

