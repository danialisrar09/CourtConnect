const mapRequestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const cacheState = res.locals.mapCacheHit ? 'HIT' : 'MISS';
    const count = typeof res.locals.mapResultCount === 'number' ? ` count=${res.locals.mapResultCount}` : '';
    console.log(
      `[MAP_REQUEST] ${req.method} ${req.originalUrl} status=${res.statusCode} ${cacheState}${count} duration=${durationMs}ms`
    );
  });

  next();
};

module.exports = {
  mapRequestLogger,
};
