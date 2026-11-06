import 'dotenv/config';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();
const port = Number(process.env.PORT || 3001);
const client = new MongoClient(process.env.MONGODB_URI || '', { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, tls: true });
app.use((req, res, next) => {
  const origin = process.env.CATELLE_SITE_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: '12mb' }));

const allowedFields = ['title', 'excerpt', 'content', 'category', 'culturalArea', 'contentType', 'author', 'coverImage', 'status'];
const themes = ['Traditions et expressions orales', 'Arts du spectacle', 'Pratiques sociales, rituels', 'Pratiques artisanales et sciences traditionnelles', 'Focus festivals'];
const culturalAreas = ['Soudano-Sahélien', 'Sawa', 'Fang-Beti', 'Grassfields'];
const cleanArticle = (body) => Object.fromEntries(allowedFields.map((key) => [key, typeof body[key] === 'string' ? body[key].trim() : '']));
async function collection() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await client.connect();
  return client.db(process.env.MONGODB_DB || 'anansi').collection('articles');
}
async function namedCollection(name) {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  await client.connect();
  return client.db(process.env.MONGODB_DB || 'anansi').collection(name);
}

const portfolioFields = ['slug', 'kind', 'title', 'org', 'period', 'category', 'summary', 'body', 'tags', 'status', 'featured', 'related', 'image', 'gallery', 'document', 'externalLinks'];
const portfolioKinds = ['experience', 'projects', 'education', 'learning', 'fellowships', 'volunteering', 'awards', 'articles'];
const portfolioStatuses = ['published', 'draft'];
const cleanPortfolioEntry = (body) => {
  const entry = Object.fromEntries(portfolioFields.map((key) => [key, body[key]]));
  entry.slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
  entry.kind = portfolioKinds.includes(entry.kind) ? entry.kind : 'articles';
  entry.title = typeof entry.title === 'string' ? entry.title.trim() : '';
  entry.org = typeof entry.org === 'string' ? entry.org.trim() : '';
  entry.period = typeof entry.period === 'string' ? entry.period.trim() : '';
  entry.category = typeof entry.category === 'string' ? entry.category.trim() : '';
  entry.summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
  entry.body = Array.isArray(entry.body) ? entry.body.filter((value) => typeof value === 'string') : [];
  entry.tags = Array.isArray(entry.tags) ? entry.tags.filter((value) => typeof value === 'string') : [];
  entry.status = portfolioStatuses.includes(entry.status) ? entry.status : 'draft';
  entry.featured = Boolean(entry.featured);
  entry.related = Array.isArray(entry.related) ? entry.related.filter((value) => typeof value === 'string') : [];
  entry.gallery = Array.isArray(entry.gallery) ? entry.gallery.filter((value) => typeof value === 'string') : [];
  entry.image = typeof entry.image === 'string' && entry.image ? entry.image : undefined;
  entry.document = typeof entry.document === 'string' && entry.document ? entry.document.trim() : undefined;
  entry.externalLinks = Array.isArray(entry.externalLinks) ? entry.externalLinks.filter((value) => value && typeof value.label === 'string' && typeof value.href === 'string') : [];
  return entry;
};
const serializePortfolio = (entry) => ({ ...entry, _id: entry._id?.toString() });
async function portfolioCollection() { return namedCollection('portfolio_entries'); }

app.get('/api/articles', async (_req, res) => {
  try { res.json(await (await collection()).find().sort({ updatedAt: -1, createdAt: -1 }).toArray()); }
  catch (error) { res.status(500).json({ message: error.message }); }
});
app.post('/api/articles', async (req, res) => {
  try {
    const article = cleanArticle(req.body);
    if (!article.title || !article.content || !themes.includes(article.category) || !culturalAreas.includes(article.culturalArea)) return res.status(400).json({ message: 'Titre, thème, aire culturelle et contenu sont requis.' });
    const now = new Date(); const articles = await collection(); const result = await articles.insertOne({ ...article, status: article.status || 'Brouillon', createdAt: now, updatedAt: now });
    res.status(201).json(await articles.findOne({ _id: result.insertedId }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});
app.put('/api/articles/:id', async (req, res) => {
  try {
    const article = cleanArticle(req.body);
    if (!article.title || !article.content || !themes.includes(article.category) || !culturalAreas.includes(article.culturalArea)) return res.status(400).json({ message: 'Titre, thème, aire culturelle et contenu sont requis.' });
    const articles = await collection(); const id = new ObjectId(req.params.id);
    await articles.updateOne({ _id: id }, { $set: { ...article, status: article.status || 'Brouillon', updatedAt: new Date() } }); res.json(await articles.findOne({ _id: id }));
  } catch (error) { res.status(400).json({ message: error.message }); }
});
app.delete('/api/articles/:id', async (req, res) => {
  try { await (await collection()).deleteOne({ _id: new ObjectId(req.params.id) }); res.status(204).end(); }
  catch (error) { res.status(400).json({ message: error.message }); }
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const filter = req.query.scope === 'admin' ? {} : { status: 'published' };
    const rows = await (await portfolioCollection()).find(filter).sort({ updatedAt: -1, createdAt: 1 }).toArray();
    res.json(rows.map(serializePortfolio));
  } catch (error) { res.status(500).json({ message: error.message }); }
});
app.post('/api/portfolio', async (req, res) => {
  try {
    const entry = cleanPortfolioEntry(req.body);
    if (!entry.slug || !entry.title || !entry.summary) return res.status(400).json({ message: 'Slug, title and summary are required.' });
    const now = new Date(); const portfolio = await portfolioCollection();
    const result = await portfolio.insertOne({ ...entry, createdAt: now, updatedAt: now });
    res.status(201).json(serializePortfolio(await portfolio.findOne({ _id: result.insertedId })));
  } catch (error) { res.status(500).json({ message: error.message }); }
});
app.put('/api/portfolio/:id', async (req, res) => {
  try {
    const entry = cleanPortfolioEntry(req.body); const portfolio = await portfolioCollection(); const id = new ObjectId(req.params.id);
    if (!entry.slug || !entry.title || !entry.summary) return res.status(400).json({ message: 'Slug, title and summary are required.' });
    await portfolio.updateOne({ _id: id }, { $set: { ...entry, updatedAt: new Date() } });
    res.json(serializePortfolio(await portfolio.findOne({ _id: id })));
  } catch (error) { res.status(400).json({ message: error.message }); }
});
app.delete('/api/portfolio/:id', async (req, res) => {
  try { await (await portfolioCollection()).deleteOne({ _id: new ObjectId(req.params.id) }); res.status(204).end(); }
  catch (error) { res.status(400).json({ message: error.message }); }
});
app.get('/api/settings', async (_req, res) => {
  try { res.json(await (await namedCollection('settings')).findOne({ key: 'website' }) || {}); }
  catch (error) { res.status(500).json({ message: error.message }); }
});
app.put('/api/settings', async (req, res) => {
  try {
    const allowed = ['heroTitle', 'heroSubtitle', 'editorialTitle', 'editorialText', 'artisanTitle', 'artisanExcerpt', 'festivalTitle', 'podcastTitle', 'podcastExcerpt', 'newsletterTitle'];
    const values = Object.fromEntries(allowed.map((key) => [key, typeof req.body[key] === 'string' ? req.body[key].trim() : '']));
    const settings = await namedCollection('settings');
    await settings.updateOne({ key: 'website' }, { $set: { ...values, updatedAt: new Date() } }, { upsert: true });
    res.json(await settings.findOne({ key: 'website' }));
  } catch (error) { res.status(500).json({ message: error.message }); }
});
app.post('/api/partners', async (req, res) => {
  try {
    const fields = ['name', 'organization', 'email', 'phone', 'interest', 'message'];
    const submission = Object.fromEntries(fields.map((key) => [key, typeof req.body[key] === 'string' ? req.body[key].trim() : '']));
    if (!submission.name || !submission.email || !submission.interest || !submission.message) return res.status(400).json({ message: 'Nom, email, type de partenariat et message sont requis.' });
    await (await namedCollection('partner_requests')).insertOne({ ...submission, status: 'Nouveau', createdAt: new Date() });
    res.status(201).json({ message: 'Votre proposition a bien été transmise.' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});
if (process.env.NODE_ENV !== 'production' || process.env.RUN_LOCAL_SERVER === 'true') {
  app.listen(port, () => console.log(`Anansi API listening on http://localhost:${port}`));
}

export default app;
