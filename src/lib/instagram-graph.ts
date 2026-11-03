/**
 * Integração Oficial com a Meta Graph API (Instagram Graph API).
 * Permite a publicação direta de fotos, carrosséis e reels no feed do Instagram Business.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export interface PublishPhotoParams {
  instagramBusinessId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}

export interface PublishResult {
  success: boolean;
  meta_post_id?: string;
  permalink?: string;
  error?: string;
}

/**
 * 1. Publica uma foto única no feed do Instagram Business
 */
export async function publishPhotoToInstagram(params: PublishPhotoParams): Promise<PublishResult> {
  try {
    const { instagramBusinessId, accessToken, imageUrl, caption } = params;

    // Passo 1: Criar o Container de Mídia
    const containerRes = await fetch(`${GRAPH_API_BASE}/${instagramBusinessId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    });

    const containerData = await containerRes.json();
    if (containerData.error) {
      console.error('[Meta Graph API] Erro ao criar container:', containerData.error);
      return { success: false, error: containerData.error.message || 'Falha ao preparar mídia na Meta' };
    }

    const creationId = containerData.id;
    if (!creationId) {
      return { success: false, error: 'Meta não retornou creation_id' };
    }

    // Passo 2: Publicar o Container no Feed
    const publishRes = await fetch(`${GRAPH_API_BASE}/${instagramBusinessId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (publishData.error) {
      console.error('[Meta Graph API] Erro ao publicar mídia:', publishData.error);
      return { success: false, error: publishData.error.message || 'Falha ao publicar no feed' };
    }

    return {
      success: true,
      meta_post_id: publishData.id,
    };
  } catch (err: any) {
    console.error('[Meta Graph API] Exceção de rede:', err);
    return { success: false, error: err?.message || 'Erro de conexão com a Meta API' };
  }
}

/**
 * 2. Valida o Token e busca dados da Conta do Instagram
 */
export async function verifyInstagramConnection(params: {
  instagramBusinessId: string;
  accessToken: string;
}): Promise<{ valid: boolean; username?: string; name?: string; profile_picture_url?: string; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${params.instagramBusinessId}?fields=id,username,name,profile_picture_url&access_token=${params.accessToken}`
    );
    const data = await res.json();
    if (data.error) {
      return { valid: false, error: data.error.message };
    }
    return {
      valid: true,
      username: data.username,
      name: data.name,
      profile_picture_url: data.profile_picture_url,
    };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Erro ao conectar à Meta API' };
  }
}
