# AgentChain: Marketplace & Verified Reviews Specification

## 1. Database-Driven Marketplace

The AgentChain Marketplace (`GET /api/v1/marketplace/agents`) is 100% database-driven and displays **only** agents with `status == "PUBLISHED"`.

### Features:
- **Zero Pre-Seeded Fixtures**: Fresh database installations contain 0 public agents. UI displays empty state ("No marketplace agents matching criteria").
- **Server-Side Filtering**: Filter by category, text search (`name` or `description`), price range (`min_price`, `max_price`), and sorting (`newest`, `price_asc`, `price_desc`).
- **Database Indexing**: Performance optimized using composite indexes `idx_agents_category_status` and `idx_agents_owner_status`.

---

## 2. Verified Reviews & Rating Security

Reviews and ratings (`POST /api/v1/marketplace/agents/{id}/review`) are strictly protected:

1. **Verified Purchase Requirement**: A user can leave a review **only** if they have a completed task (`Task.created_by == user.id` and `Task.status == "COMPLETED"`) using the agent.
2. **Self-Review Denial**: Agent owners are forbidden from submitting reviews for their own agents (`HTTP 403`).
3. **Server-Side Rating Aggregation**: Frontend cannot submit aggregate ratings. Ratings are dynamically computed via SQL `func.avg(AgentReview.rating)`.
