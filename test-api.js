fetch('http://localhost:3000/api/improve-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "hola este osea hola" })
})
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
