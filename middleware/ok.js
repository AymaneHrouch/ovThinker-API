module.exports = function(app) {
    app.use(function (req, res) {
        res.status(404).send("Ooops motherfucker, this page doesn't exist hh.");
      });
}