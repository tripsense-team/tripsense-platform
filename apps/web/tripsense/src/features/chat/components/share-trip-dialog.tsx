"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { chatApi } from "../services/chat-api";
import type { SocialPost } from "@/features/social-post/types";

export function ShareTripDialog({ open, onOpenChange, userId, onSelect }:
  {open:boolean;onOpenChange:(open:boolean)=>void;userId:string;onSelect:(postId:string)=>void}) {
  const {t}=useTranslation();
  const [posts,setPosts]=React.useState<SocialPost[]>([]);
  const [loading,setLoading]=React.useState(false);
  const [failed,setFailed]=React.useState(false);
  React.useEffect(()=>{
    if (!open || !userId) return;
    let canceled=false; setLoading(true); setFailed(false);
    void chatApi.shareableTrips(userId).then((items)=>{if(!canceled)setPosts(items);})
      .catch(()=>{if(!canceled)setFailed(true);})
      .finally(()=>{if(!canceled)setLoading(false);});
    return ()=>{canceled=true;};
  },[open,userId]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{t("chat.sharedTrip.shareAction")}</DialogTitle>
        <DialogDescription>{t("chat.sharedTrip.choosePublic")}</DialogDescription></DialogHeader>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {loading ? <p className="text-sm text-muted-foreground">{t("chat.sidebar.loadingAria")}</p> :
          failed ? <p role="alert" className="text-sm text-destructive">{t("chat.errors.loadErrorDesc")}</p> :
          posts.length===0 ? <p className="text-sm text-muted-foreground">{t("chat.sharedTrip.noPublicTrips")}</p> :
          posts.map((post)=><Button key={post.id} variant="outline" className="h-auto w-full justify-start p-3 text-left"
            onClick={()=>{onSelect(post.id);onOpenChange(false);}}>{post.trip?.name || post.content}</Button>)}
      </div>
    </DialogContent>
  </Dialog>;
}
