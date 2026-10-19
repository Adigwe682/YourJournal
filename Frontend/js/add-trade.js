const tradeForm = document.querySelector("form");

tradeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(tradeForm);

    const trade = {
        pair: formData.get("pair"),
        date: formData.get("date"),
        rr: formData.get("rr"),
        pnl: formData.get("pnl"),
        result: formData.get("result"),
    };

    console.log(trade);

    const token = localStorage.getItem("token");

    const response = await fetch("https://yourjournal.onrender.com/api/trades", {
        method: "POST",

        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },

        body: JSON.stringify(trade),
    });

    const data = await response.json();

    console.log(data);

    if (data.success) {
  window.location.href = "./dashboard.html";
}
});

