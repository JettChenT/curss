use crate::curius::model::Content;
use rss_gen::RssItem;

impl Content {
    pub fn to_rss_item(self) -> RssItem {
        RssItem::new()
            .guid(format!("curius-{}", self.id))
            .link(self.link)
            .title(self.title)
            .description(self.snippet.unwrap_or_default())
            .pub_date(self.created_date)
            .author("curius")
    }
}
